// Import fetch, client from discord.js and cheerio
const cheerio = require("cheerio");
const fs = require("fs");

const getItems = async () => {
  try {
    const baseUrl = "https://kims.dk/kategori/undgaasnackspild/"
    const pages = [baseUrl];
    const response = await fetch(baseUrl);
    const data = await response.text();
    const $ = cheerio.load(data);
    
    $("#pagination_side option").each((i, element) => {
      const pageUrl = $(element).attr("value");
      if (pageUrl && !pages.includes(pageUrl)) {
        pages.push(pageUrl);
      }
    });

    const currentItems = [];
    for (const page of pages) {
      const items = await scrapePage(page);
      currentItems.push(...items);
    }

    return currentItems;
  } catch (error) {
    console.error("woops");
    console.error(error);
    throw new Error("FAILED_TO_FETCH_ITEMS");
  }
};

const scrapePage = async (url) => {
  console.log(`Fetching page: ${url}`);
  const pageResponse = await fetch(url);
  const pageData = await pageResponse.text();
  const $$ = cheerio.load(pageData);

  const items = [];
  $$("li.product").each((i, element) => {
    const item = {
      title: $$(element).find("p.woocommerce-loop-product__title").text(),
      price: $$(element).find("span.price").first().text(),
      url: $$(element).find("a").attr("href"),
    };
    items.push(item);
  });

  console.log('Items found on page:', items);
  return items;
}

const sendWebhook = async (webHookUrl, content) => {
  try {
    const response = await fetch(webHookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: content,
      }),
    });

    return response;
  } catch (error) {
    console.error("woops");
    console.error(error);
    throw new Error("FAILED_TO_USE_WEBHOOK");
  }
};

// Check for new items
const currentItems = getItems();

currentItems.then((currentItems) => {
  const oldItems =
    fs.existsSync("./items.json") &&
    (result = fs.readFileSync("./items.json", "utf8"))
      ? JSON.parse(result)
      : [];

  // Find the difference between the old and new items using filter/map on title, price and url parameters
  const newItems = currentItems.filter(
    (currentItem) =>
      !oldItems.some(
        (oldItem) =>
          oldItem.title === currentItem.title &&
          oldItem.price === currentItem.price &&
          oldItem.url === currentItem.url
      )
  );
  
  if (newItems.length !== 0) {
    // Send message to channel with new items
    const webhookResponse = sendWebhook(
      process.env.WEBHOOK_URL,
      "@everyone Nye chips i kisten!" + "\n" + chipsJSONToString(newItems)
    );
  }
  
  fs.writeFileSync("./items.json", JSON.stringify(currentItems, null, 2)); // TODO Replace with database for serverless?
});

// Format the items into [title](url) - price
function chipsJSONToString(chips) {
  return chips
    .map((chip) => `[${chip.title}](${chip.url}) - ${chip.price}`)
    .join("\n");
}
