import discord from "discord.js";
import { config as envConfig } from "dotenv";

import { messageCreateHandler } from "./commands/handlers";
import { init } from "./helpers/svt";
import { clearIntervals, clearTimeouts } from "./helpers/timeouts";

envConfig();

const client = new discord.Client({ intents: 32265, partials: ["CHANNEL", "MESSAGE"] }); //[Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGES] });
const TOKEN = process.argv.map((arg) => arg.toLowerCase()).includes("dev") ? process.env.DEV_TOKEN : process.env.BOT_TOKEN;

const readyLogs = () => {
    const levels = {
        alert: 1,
        error: 3,
        warn: 4,
        info: 6,
        log: 7,
    };

    Object.defineProperty(console, "_log", console.log);

    for (const [level, priority] of Object.entries(levels)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (console as any)[level] = (...args: any[]) => {
            const line = [`<${priority}>`];

            args.map((arg) => {
                if (typeof arg !== "string") {
                    try {
                        arg = JSON.stringify(arg);
                    } catch (err) {
                        arg = arg.toString ? arg.toString : arg;
                    }
                }

                line.push(arg);
            });

            process.stdout.write(`${line.join(" ")}\n`);
        };
    }
};

readyLogs();

init()
    .then(() => {
        client.on("ready", () => {
            console.info(`Logged in as ${client.user?.tag}!`);
            client.user?.setActivity("you", {
                type: "WATCHING",
            });
        });

        client.on("messageCreate", messageCreateHandler);

        client.login(TOKEN);
    })
    .catch((err) => {
        console.error(err);
        process.exit(10); // ERROR
    });

/**
 * Quits gracefully by clearing active timeouts and destroying the open client.
 */
export function quit() {
    // Clear active timeouts, if any
    clearTimeouts();
    // Clear active timeouts, if any
    clearIntervals();
    // Destroy client (stops discord event loop)
    client.destroy();
}

process.on("SIGTERM", () => {
    console.log("Got SIGTERM, quitting...");
    quit();
});
