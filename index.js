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

const extractProductInfo = ($, element) => {
  // Extract name, price, url
  const name = $(element).find("p.woocommerce-loop-product__title").text();
  const price = $(element).find("span.price").first().text().replace(',', '.').replace('kr.', '').trim();
  const url = $(element).find("a").attr("href");

  // Extract weight
  const weightMatch = name.match(/(\d+x\d+g|\d+g)/);
  let weight = '-';
  if (weightMatch) {
    weight = weightMatch[0].replace('g', '');
    if (weight.includes('x')) {
      const [quantity, unitWeight] = weight.split('x').map(str => parseInt(str, 10));
      weight = `${quantity * unitWeight}`;
    }
  }

  // Extract date
  const dateMatch = name.match(/\d{2}\.\d{2}\.\d{4}$/);
  const date = dateMatch ? dateMatch[0] : '-';

  return {
    name,
    price,
    url,
    weight,
    date,    
  };
};

// It is what it is
const extractNutritionalInfo = ($$$) => ({
  calories: $$$("th:contains('Energi')").next().text().split('/').pop().trim(),
  fat: $$$("th:contains('Fedt')").next().text().replace('g', ''),
  saturated_fat: $$$("th:contains('heraf mættede fedtsyrer')").next().text().replace('g', '').trim(),
  carbohydrates: $$$("th:contains('Kulhydrat')").next().text().replace('g', ''),
  sugar: $$$("th:contains('heraf sukkerarter')").next().text().replace('g', '').trim(),
  dietary_fiber: $$$("th:contains('Kostfibre')").next().text().replace('g', ''),
  protein: $$$("th:contains('Protein')").next().text().replace('g', ''),
  salt: $$$("th:contains('Salt')").next().text().replace('g', ''),
  ingredients: $$$("div.indgredienser").text().replace('Ingredienser: ', '')
});

const scrapePage = async (url) => {
  console.log(`Fetching page: ${url}`);
  const pageResponse = await fetch(url);
  const pageData = await pageResponse.text();
  const $$ = cheerio.load(pageData);
  const items = [];
  const productLinks = [];

  $$("li.product").each((i, element) => {
    const item = extractProductInfo($$, element);
    items.push(item);
    productLinks.push(item.url)
  });

  for (const link of productLinks) {
    console.log(`Fetching product page: ${link}`);
    const productResponse = await fetch(link);
    const productData = await productResponse.text();
    const $$$ = cheerio.load(productData);
    const additionalInfo = extractNutritionalInfo($$$)
    const itemIndex = items.findIndex(item => item.url === link);
    items[itemIndex] = { ...items[itemIndex], ...additionalInfo };
  }

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
          oldItem.name === currentItem.name &&
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

// Format the items into [name](url) - price
function chipsJSONToString(chips) {
  return chips
    .map((chip) => `[${chip.name}](${chip.url}) - ${chip.price}`)
    .join("\n");
}