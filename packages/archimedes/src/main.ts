import { config as envConfig } from "dotenv";
import discord from "discord.js";
import { messageCreateHandler } from "./commands/handlers";
import { init } from "./helpers/svt";

envConfig();

const client = new discord.Client({ intents: 32265, partials: ["CHANNEL", "MESSAGE"] }); //[Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGES] });
const TOKEN = process.argv.map((arg) => arg.toLowerCase()).includes("dev") ? process.env.DEV_TOKEN : process.env.BOT_TOKEN;

init().then(() => {
    client.on("ready", () => {
        console.info(`Logged in as ${client.user!.tag}!`);
        client.user!.setActivity("you", {
            type: "WATCHING",
        });
    });

    client.on("messageCreate", messageCreateHandler);

    client.login(TOKEN);
});
