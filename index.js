// Import fetch, client from discord.js and cheerio
const { Client, GatewayIntentBits } = require("discord.js");
const cheerio = require("cheerio");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const getItems = () => {
  return new Promise(async (resolve, reject) => {
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

      resolve(currentItems);
    } catch (error) {
      reject(error);
    }
  });
};

client.on("ready", () => {
  channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);

  if (channel) {
    // Check for new items
    getItems().then((items) => {
      const currentItems = items;
      // Import old items from items.json. If it doesn't exist, oldItems will be an empty array
      const oldItems =
        fs.existsSync("./items.json") && fs.readFileSync("./items.json", "utf8")
          ? JSON.parse(fs.readFileSync("./items.json", "utf8"))
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
        channel.send(
          "Nye chips i kisten!" + "\n" + chipsJSONToString(newItems)
        );
      }
    });
  }
});

// Filthy hack to shut down the bot
client.on("messageCreate", (message) => {
  if (message.author.id === process.env.DISCORD_BOT_ID) {
    client.destroy();
    process.exit();
  }
});

// Format the items into [title](url) - price
function chipsJSONToString(chips) {
  return chips
    .map((chip) => `[${chip.title}](${chip.url}) - ${chip.price}`)
    .join("\n");
}

client.login(process.env.DISCORD_BOT_TOKEN);
