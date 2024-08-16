// Import fetch, client from discord.js and cheerio
const cheerio = require("cheerio");
const fs = require("fs");
const { Client } = require("pg");

const client = new Client({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

client
  .connect()
  .then(() => console.log("Connected to database"))
  .catch((err) => console.error("Failed to connect to database", err.stack));

client.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Error executing query", err.stack);
  } else {
    console.log("Query result:", res.rows[0]);
  }
  client.end();
});

const getItems = async () => {
  try {
    const baseUrl = "https://kims.dk/kategori/undgaasnackspild/";
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
  // Scrape name, price, url
  const name = $(element).find("p.woocommerce-loop-product__title").text();
  const price = $(element)
    .find("span.price")
    .first()
    .text()
    .replace(",", ".")
    .replace("kr.", "")
    .trim();
  const url = $(element).find("a").attr("href");

  // Weight from name
  const weightMatch = name.match(/(\d+x\d+g|\d+g)/);
  let weight = "-";
  if (weightMatch) {
    weight = weightMatch[0].replace("g", "");
    if (weight.includes("x")) {
      const [quantity, unitWeight] = weight
        .split("x")
        .map((str) => parseInt(str, 10));
      weight = `${quantity * unitWeight}`;
    }
  }

  // Date from name
  const dateMatch = name.match(/\d{2}\.\d{2}\.\d{4}$/);
  const date = dateMatch ? dateMatch[0] : "-";

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
  calories: $$$("th:contains('Energi')").next().text().split("/").pop().trim(),
  fat: $$$("th:contains('Fedt')").next().text().replace("g", ""),
  saturated_fat: $$$("th:contains('heraf mættede fedtsyrer')")
    .next()
    .text()
    .replace("g", "")
    .trim(),
  carbohydrates: $$$("th:contains('Kulhydrat')").next().text().replace("g", ""),
  sugar: $$$("th:contains('heraf sukkerarter')")
    .next()
    .text()
    .replace("g", "")
    .trim(),
  dietary_fiber: $$$("th:contains('Kostfibre')").next().text().replace("g", ""),
  protein: $$$("th:contains('Protein')").next().text().replace("g", ""),
  salt: $$$("th:contains('Salt')").next().text().replace("g", ""),
  ingredients: $$$("div.indgredienser").text().replace("Ingredienser: ", ""),
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
    productLinks.push(item.url);
  });

  for (const link of productLinks) {
    // console.log(`Fetching product page: ${link}`);
    const productResponse = await fetch(link);
    const productData = await productResponse.text();
    const $$$ = cheerio.load(productData);
    const additionalInfo = extractNutritionalInfo($$$);
    const itemIndex = items.findIndex((item) => item.url === link);
    items[itemIndex] = { ...items[itemIndex], ...additionalInfo };
  }

  // console.log('Items found on page:', items);
  return items;
};

const sendWebhook = async (webHookUrl, content) => {
  if (content.length > 2000) {
    throw new Error("CONTENT_TOO_LONG");
  }

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
    // Compose a list of messages to be send
    messageList = ["everyone Nye chips i kisten!\n"];
    message = [];
    msgStrLen = 0;
    for (let i = 0; i < newItems.length; i++) {
      // Format item for discord message
      itemString = `[${newItems[i].name}](<${newItems[i].url}>) - ${newItems[i].price}`;

      // Message cannot total more than 2k characters
      if (msgStrLen + itemString.length + 1 <= 2000) {
        message.push(itemString);
        msgStrLen += itemString.length + 1;
      } else {
        messageList.push(message.join("\n"));
        message = [itemString];
        msgStrLen = itemString.length + 1;
      }
    }

    // Add message containing remaining items
    if (message.length > 0) {
      messageList.push(message.join("\n"));
    }

    // Function to delay execution of requests
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Function to send message to webhook
    const sendMessage = async (message) => {
      const webhookResponse = await sendWebhook(
        process.env.WEBHOOK_URL,
        message
      );

      console.log("Webhook sent:", webhookResponse);
    };

    // Function to send all messages
    const sendMessages = async (messageList) => {
      for (const message of messageList) {
        await sendMessage(message);
        await delay(500);
      }
    };

    sendMessages(messageList);
  }

  fs.writeFileSync("./items.json", JSON.stringify(currentItems, null, 2)); // TODO Replace with database for serverless?
});