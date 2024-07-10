// Import fetch, client from discord.js and cheerio
const { WebhookClient } = require("discord.js");
const cheerio = require("cheerio");
const fs = require("fs");

const webHookClient = new WebhookClient({
  url: process.env.WEBHOOK_URL,
});

const getItems = async () => {
  try {
    const response = await fetch(
      "https://kims.dk/kategori/undgaasnackspild/?orderby=price&stoerrelse-poser=almindelig&type-form=riflede"
    );
    const data = await response.text();
    const $ = cheerio.load(data);
    const currentItems = [];

    $("li.product").each((i, element) => {
      const item = {
        title: $(element).find("p.woocommerce-loop-product__title").text(),
        price: $(element).find("span.price").text(),
        url: $(element).find("a").attr("href"),
      };

      currentItems.push(item);
    });

    return currentItems;
  } catch (error) {
    console.error("woops");
    console.error(error);
    throw new Error("FAILED_TO_FETCH_ITEMS");
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
    // Update items.json with new items
    fs.writeFileSync("./items.json", JSON.stringify(currentItems, null, 2)); // TODO Replace with database for serverless?

    // Send message to channel with new items
    webHookClient.send({
      content:
        "@everyone Nye chips i kisten!" + "\n" + chipsJSONToString(newItems),
    });
  }
});

// Format the items into [title](url) - price
function chipsJSONToString(chips) {
  return chips
    .map((chip) => `[${chip.title}](${chip.url}) - ${chip.price}`)
    .join("\n");
}
