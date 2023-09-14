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

            //--- Get stack info to identify caller
            const callerDetailsLine = (new Error().stack || "").split("\n")[2]; // ` at <function> (filename:line_number)`
            const callerDetails = callerDetailsLine.split(/\s+/).filter((word) => !!word.trim() && word !== "at");
            let callerFunction = "",
                callerFile = "";

            if (callerDetails.length === 1) {
                // Probably an anonymous function,
                // `filename:line_number`
                callerFunction = "<anonymous function>";
                callerFile = callerDetails[0];
            } else if (callerDetails.length > 1) {
                // Probably a named function,
                // `<function> (filename:line_number)`
                callerFunction = callerDetails[0];
                callerFile =
                    callerDetails.length === 2 ? callerDetails[1] : /* space-separated filename */ callerDetails.slice(1).join(" ");
            }

            callerFile = callerFile.replace(/^\(/, ""); // Remove opening parenthesis
            callerFile = callerFile.replace(/\)$/, ""); // Remove closing parenthesis

            if (callerFunction.includes("Object.<anonymous>")) {
                callerFunction = "<anonymous function>";
            }

            // No need to include the whole path; if the base path exists in callerFile,
            // split along the base path and use only the leaves; if it doesn't,
            // the split array only contains 1 element that is still used.
            const callerFileParts = callerFile.split(/archimedes-fgo\/packages\/archimedes\/(src|dist)\//);
            callerFile = callerFileParts[callerFileParts.length - 1];

            if (["alert", "error", "warn", "log"].includes(level) && !!callerFile) {
                line.push(`[${callerFile} - ${callerFunction}]:`);
            }

            args.map((arg) => {
                if (typeof arg !== "string") {
                    try {
                        arg = JSON.stringify(arg);
                    } catch (err) {
                        arg = arg.toString ? arg.toString() : arg;
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
    quit();
});
