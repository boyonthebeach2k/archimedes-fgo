import { EmbedField, EmojiIdentifierResolvable, Message, MessageActionRowComponent, MessageEmbedOptions } from "discord.js";

import { emoji } from "../assets/assets";
import { scheduleTimeout } from "../helpers/timeouts";

// eslint-disable-next-line @typescript-eslint/no-var-requires
let commands = require("./commands").commands;

const BANG = "!" as const,
    DOT = "." as const;

const hotCommands = ["link", "unlink"]; //commands that need reloading after being called

async function messageCreateHandler(message: Message) {
    let prefix: "!" | "." = BANG;

    if (message.guild?.id && process.env.DOT_GUILDS?.includes(message.guild.id)) prefix = DOT;
    else if (message.guild !== null) prefix = BANG;

    if (message.content === process.env.BOT_RIN_TAG) {
        message.channel.send(process.env.BOT_RIN_TAG + " is NOOB");
        return;
    }

    if (message.guild === null && message.content.startsWith(DOT)) message.content = message.content.slice(1);

    if (message.guild?.id === process.env.MASTER_GUILD && message.content.startsWith(DOT))
        message.content = BANG + message.content.slice(1);

    if (
        !message.content.startsWith(prefix) &&
        !((process.env.NO_PREFIX_CHANNEL || "").split(" ").includes(message.channel.id) || message.guild === null)
    )
        return;

    let commandBody: string, command: string, argChunks: string[];

    let reply:
        | {
              embeds: { title: string; fields: EmbedField[]; name: string; content?: string; waveNo?: number }[];
              type: "card" | "chain" | "enemy";
          }
        | { content: string };

    if (!((process.env.NO_PREFIX_CHANNEL || "").split(" ").includes(message.channel.id) || message.guild === null))
        commandBody = message.content.slice(prefix.length).trim();
    else commandBody = message.content.startsWith(prefix) ? message.content.slice(prefix.length).trim() : message.content.trim();

    if (commandBody.length == 0) return;

    try {
        [command, ...argChunks] = commandBody.split(/\s+/);
        command = command.toLowerCase();

        if (command !== "link") {
            argChunks = argChunks.map((argChunk) => argChunk.toLowerCase());
        }

        if (commands.has(command)) {
            reply = await commands.get(command)?.(argChunks.join(" "), message);

            if (hotCommands.includes(command)) {
                delete require.cache[require.resolve("./commands")];
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                commands = require("./commands").commands;
            }
        } else {
            reply = { content: `'${command}' not recognised!` };
        }

        if (!reply) {
            return;
        }

        let replyEmbed: Message;

        if (typeof reply === "object" && "embeds" in reply) {
            const embeds = reply.embeds;

            if (Math.random() < 0.015) {
                // Say bye to your next SR
                embeds[0].title = emoji("gateofsnekked");
            }

            if (reply.type === "card") {
                replyEmbed = await message.channel.send({
                    embeds: [embeds[0]],
                    components: [
                        {
                            type: "ACTION_ROW",
                            components: [
                                { type: "BUTTON", label: "Damage", style: "SECONDARY", customId: "damage" },
                                ...(embeds.find((embed) => embed.name === "refundStars")
                                    ? [
                                          {
                                              type: "BUTTON" as const,
                                              label: "Refund & Stars",
                                              style: "SECONDARY" as const,
                                              customId: "refundStars",
                                          },
                                      ]
                                    : []),
                                { type: "BUTTON", label: "Verbose Calc", style: "SECONDARY", customId: "verboseDamage" },
                            ],
                        },
                    ],
                });
            } else if (reply.type === "chain") {
                replyEmbed = await message.channel.send({
                    embeds: [embeds[0]],
                    components: [
                        {
                            type: "ACTION_ROW",
                            components: [
                                {
                                    customId: "cardPages",
                                    placeholder: "Select card details to view",
                                    options: [
                                        { label: "Chain summary", value: "0", description: "View chain summary", default: false },
                                        ...embeds.slice(1).map((embed, index) => ({
                                            label: `Card ${index + 1} verbose`,
                                            value: index + 1 + "",
                                            description: `View detailed info for card ${index + 1}`,
                                            default: false,
                                            emoji: {
                                                name: embed.title?.split(" ")?.[0]?.split(":")?.[1] ?? "",
                                                id: embed.title?.split(" ")?.[0]?.split(":")?.[2]?.split(">")?.[0] ?? "",
                                            } as EmojiIdentifierResolvable,
                                        })),
                                    ],
                                    minValues: 1,
                                    maxValues: 1,
                                    type: "SELECT_MENU",
                                },
                            ],
                        },
                    ],
                });
            } else if (reply.type === "enemy") {
                replyEmbed = await message.channel.send({
                    embeds: [embeds[0]],
                    components: [
                        {
                            type: "ACTION_ROW",
                            components: [
                                { type: "BUTTON", label: "Previous wave", style: "SECONDARY", customId: "previousWave" },
                                { type: "BUTTON", label: "Summary", style: "SECONDARY", customId: "summary" },
                                { type: "BUTTON", label: "Next wave", style: "SECONDARY", customId: "nextWave" },
                            ],
                        },
                    ],
                });
            } else {
                // The reply has embeds but it is not one of the aforementioned types

                if (["commands", "help", "h"].includes(command)) {
                    (embeds[0] as unknown as { footer: { text: string } }).footer = { text: `Prefix: ${prefix}` };
                }

                replyEmbed = await message.channel.send({ embeds });

                return;
            }

            if (replyEmbed.components) {
                const collector = replyEmbed?.createMessageComponentCollector({
                    filter: function filter(i) {
                        if (i.user.id !== message.author.id) {
                            i.reply({
                                content:
                                    "You cannot interact with this message as you have not triggered the command. Please send another command.",
                                ephemeral: true,
                            });
                            return false;
                        }
                        return true;
                    },
                    time: 300000,
                });

                let currentWaveNo = 0; // Start with wave summary; this is only used if reply type is `enemy`

                collector.on("collect", async (interaction) => {
                    if (["damage", "verboseDamage", "refundStars"].includes(interaction.customId)) {
                        interaction.update({
                            embeds: [embeds.find((embed) => embed.name === interaction.customId) as MessageEmbedOptions],
                        });

                        return;
                    } else if (interaction.isSelectMenu()) {
                        interaction.update({
                            content: embeds[+interaction.values[0]].content ?? " ",
                            embeds: [embeds[+interaction.values[0]]] as MessageEmbedOptions[],
                        });

                        return;
                    } else if ("embeds" in reply && reply.type === "enemy") {
                        switch (interaction.customId) {
                            case "nextWave":
                                currentWaveNo = (currentWaveNo + 1) % embeds.length;
                                currentWaveNo = currentWaveNo === 0 ? 1 : currentWaveNo;
                                interaction.update({
                                    embeds: [embeds.find((embed) => embed.waveNo === currentWaveNo)] as MessageEmbedOptions[],
                                });
                                break;
                            case "previousWave":
                                currentWaveNo = currentWaveNo - 1;
                                currentWaveNo = currentWaveNo <= 0 ? embeds.length - 1 : currentWaveNo;
                                interaction.update({
                                    embeds: [embeds.find((embed) => embed.waveNo === currentWaveNo)] as MessageEmbedOptions[],
                                });
                                break;
                            default:
                                currentWaveNo = 0;
                                interaction.update({
                                    embeds: [embeds.find((embed) => embed.waveNo === currentWaveNo)] as MessageEmbedOptions[],
                                });
                                break;
                        }

                        return;
                    }
                });
                if (replyEmbed.components?.[0]?.components) {
                    // If there are any components, disable them after 5 minutes
                    scheduleTimeout(function disableComponents() {
                        replyEmbed.edit({
                            components: [
                                {
                                    type: "ACTION_ROW",
                                    components: replyEmbed.components[0].components.map((c: MessageActionRowComponent) => {
                                        c.disabled = true;
                                        return c;
                                    }),
                                },
                            ],
                        });
                    }, 300000);
                }
            }
        } else if (typeof reply === "string") {
            message.channel.send({ content: reply });
        }
    } catch (error) {
        message.channel.send({ content: error instanceof Error ? error.message : `... Something went wrong (${error})` });

        if (error instanceof Error && error.message.includes("Svt not found")) {
            return; // If Svt is not found, simply send the message, no need to log
        }
        console.error(error instanceof Error ? error.message + "; stack: " + error.stack : error);
    }
}

export { messageCreateHandler };
