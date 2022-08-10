import { calcSvt, CalcVals, ChainCalcVals, EnemyCalcVals, cmdArgs, getNps, init } from "fgo-calc";
import { emoji, nicknames } from "../assets/assets";
import { getEntities, getSvt } from "../helpers/svt";
import { getCardEmbeds, getChainEmbeds, getEnemyEmbeds } from "../helpers/embeds";
import { Message } from "discord.js";
import https from "https";
import { JSDOM } from "jsdom";
import { create, all } from "mathjs";
import fs from "fs";
import { ApiConnector, Entity, Language, Region } from "@atlasacademy/api-connector";
import { IncomingMessage } from "http";
import child_process from "child_process";

const math = create(all, {});
const NAApiConnector = new ApiConnector({ host: "https://api.atlasacademy.io", region: Region.NA, language: Language.ENGLISH });

const entityTypeDescriptions = new Map<string, string>([
    ["all", "all"],
    ["combineMaterial", "Exp Card"],
    ["commandCode", "Command Code"],
    ["enemy", "Enemy"],
    ["enemyCollection", "Enemy Servant"],
    ["enemyCollectionDetail", "Boss"],
    ["heroine", "Servant (Mash)"],
    ["normal", "Servant"],
    ["servantEquip", "Craft Essence"],
    ["statusUp", "Fou Card"],
    ["svtEquipMaterial", "svtEquipMaterial"],
    ["svtMaterialTd", "NP Enhancement Material"],
    ["mysticCode", "Mystic Code"],
    ["war", "War"],
    ["event", "Event"],
]);

const botCommandsMap = new Map<string, string>()
    .set("test (t)", "Calculate servant/enemy cards")
    .set("help (h)", "Help for !test")
    .set("getnames (g, names)", "Get nicknames for a servant")
    .set("getnps (list, l, nps)", "List servant NPs")
    .set("math(m)/calculate(calc, c)/evaluate(eval, e)", "Evaluate mathematical expression")
    .set("db (d, aa)", "Search aa-db for entity, for instance to get the ID /C.No. to calc with")
    .set("wikia (w)", "Search F/GO wikia using google")
    .set("google (bing, search, s)", "Search query with bing")
    .set("junao", "Own/Borrowed junao+waver|merlin calc")
    .set("commands", "Haha recursion");

const resourceCommandsMap = new Map<string, string>()
    .set("lookup", "Look up where to farm a material (references the dropsheets)")
    .set("ce", "CE Encyclopedia")
    .set("upgrades", "Upcoming STR and ludes")
    .set("dropsheet", "Lists the top 5 farming nodes for non-event mats (based on drop rate as well as AP/drop)")
    .set("drops", "Slightly cooler and less mobile-friendly version of the dropsheet")
    .set("submissions", "Site to submit your drop results of free quests for the dropsheet")
    .set("interludes (ludes)", "Lists the materials gained from interludes and rank up quests")
    .set("npdmg", "NP damage table for NA")
    .set("npdmgjp", "NP damage table for JP")
    .set("buffcaps", "View the possiblerange of different (de)buffs")
    .set("chargers", "Lists of NP batteries on servants")
    .set("appends", "List of servants with append s3 against class advantage")
    .set("cost", "List of cost for servants and CEs")
    .set("bond", "Bond farming spreadsheet")
    .set("sos", "Account recovery guide (NA)")
    .set("sosjp", "Account recovery guide (JP)");

const forecastResourcesCommandsMap = new Map<string, string>()
    .set("compendium", "Spreadsheet containing various information regarding future events")
    .set("forecast", "Upcoming event materials")
    .set(
        "papermoon (limited, limiteds)",
        "Spreadsheet containing lists of limited items (grails, gfous, bgrails, etc), material tickets, and event farming drop data"
    )
    .set("banners", "NA's list of upcoming banners by servant")
    .set("efficiency", "List of upcoming AP reduction campaigns")
    .set("shishoufest (scathfest, hagfest)", "Comp video archive for Dance Tournament lottery event")
    .set("karnamas (xmas6)", "Comp video archive for Christmas 6 lottery event");

const beginnerResourcesCommandsMap = new Map<string, string>()
    .set("beginners (beginner)", "Beginner's guide to FGO")
    .set("starters", "Recommended servants to raise for beginners")
    .set("hong (solo, solos, soloes)", "Video playlist of friend soloing main story + Guide on cheesing hard quests with support servants")
    .set("ticket", "Recommended servants to pick from the NA 17M DL campaign SSR ticket")
    .set("lottery (lotto)", "Explanation on lottery events")
    .set("rp", "Guide on what to buy from rp shop")
    .set("howtosave", "How to save SQ & Tickets (if you didn't already know)")
    .set("blueprism", "Explanation on blue prisms (free limited-time revive mat)")
    .set("glossary", "Explanations of community terms and abbreviations");

function getNames(servant: string) {
    let title = `No matches found for ${servant}!`,
        description = "";

    if (+servant === +servant) {
        if (nicknames[servant] && nicknames[servant].length > 0) {
            title = `Nicknames for Servant #${servant}:`;
            description = nicknames[servant].join("\n");
        }
    } else {
        const id = Object.keys(nicknames).find((id) => nicknames?.[id]?.includes(servant)) ?? -1;
        const names = nicknames?.[id] ?? "";

        if (names) {
            title = `Nicknames for ${servant} (ID #${id}):`;
            description = names.join("\n");
        }
    }

    return {
        embeds: [
            {
                title,
                description,
            },
        ],
        name: "getnames",
    };
}

async function addName(str: string, message: Message) {
    if (process.env.AUTH_USERS?.includes(message.author.id)) {
        const [id, ...nicknameWords] = str.split(" ");

        const nickname = nicknameWords.join(" ");

        if (+id === +id) {
            // If id is a number

            if (!(id in nicknames)) {
                nicknames[id] = [];
            }

            if (!nicknames[id].includes(nickname)) {
                nicknames[id].push(nickname);
                fs.writeFileSync(`${__dirname}/../../src/assets/nicknames.json`, JSON.stringify(nicknames, null, 2));
                console.log(`Set ${id}: ${nickname}`);
                return `Set ${id}: ${nickname}`;
            } else {
                return `[${id}: "${nickname}"] already exists!`;
            }
        } else {
            // If id is a string, check it's an existing nickname
            const cNo = Object.keys(nicknames).find((cNo) => nicknames?.[cNo]?.includes(id)) ?? 0;

            // If cNo is 0, then id is not a nickname
            if (cNo == 0) {
                return "Invalid ID!";
            }

            if (!nicknames[cNo].includes(nickname)) {
                nicknames[cNo].push(nickname);
                fs.writeFileSync(`${__dirname}/../../src/assets/nicknames.json`, JSON.stringify(nicknames, null, 2));
                console.log(`Set ${cNo}: ${nickname}`);
                return `Set ${cNo}: ${nickname}`;
            } else {
                return `[${id}: "${nickname}"] already exists!`;
            }
        }
    }
}

async function test(args: string) {
    const svtName = args.split(" ")[0],
        argStr = args.split(" ").slice(1).join(" ");

    if (svtName === undefined) {
        return { content: "haha :WoahWheeze:" };
    }

    const { svt, NAServant } = await getSvt(svtName);

    init(NAServant ? (await NAApiConnector.servant(svt.id)).noblePhantasms : []);

    const resultFields = calcSvt(svt, argStr);

    switch (resultFields.type) {
        case "card":
            return getCardEmbeds(resultFields.vals as CalcVals);
        case "chain":
            return getChainEmbeds(resultFields.vals as ChainCalcVals);
        case "enemy":
            return getEnemyEmbeds(resultFields.vals as EnemyCalcVals);
    }
}

async function help(args: string, message: Message) {
    let cmds = cmdArgs().filter((arg) => arg.name === args.trim().toLowerCase());

    cmds = cmds.length ? cmds : cmdArgs();

    const parts = cmds.reduce((acc, curr) => {
        if (!acc[curr.type]) {
            acc[curr.type] = [];
        }
        acc[curr.type].push(curr);
        return acc;
    }, {} as { [key: string]: typeof cmds });

    const embedMessage = await message.channel.send({
        embeds: [
            {
                title: "__Arguments List__",
                description: [...parts["General"], ...parts["Command cards"]].reduce(
                    (acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`,
                    ""
                ),
            },
        ],
        components: [
            {
                type: 1,
                components: [
                    { type: 2, label: "General", style: 2, customId: "general" },
                    { type: 2, label: "Shorthands", style: 2, customId: "shorthands" },
                    { type: 2, label: "Command Card Buffs", style: 2, customId: "cardArgs" },
                    { type: 2, label: "Non-offensive Buffs", style: 2, customId: "nonDmgArgs" },
                    { type: 2, label: "Aux", style: 2, customId: "auxMisc" },
                ],
            },
        ],
    });

    const collector = embedMessage.createMessageComponentCollector({
        filter: function filter(i) {
            if (i.user.id !== message.author.id) {
                i.reply({ content: "Please enter the command yourself to interact with it.", ephemeral: true });
                return false;
            }
            return true;
        },
        time: 300000,
    });

    collector.on("collect", async (interaction) => {
        let description = [...parts["General"], ...parts["Command cards"]].reduce(
            (acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`,
            ""
        );

        switch (interaction.customId) {
            case "shorthands":
                description = parts["Shorthands"].reduce((acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`, "");
                break;
            case "cardArgs":
                description = parts["Command card buffs"].reduce((acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`, "");
                break;
            case "nonDmgArgs":
                description = parts["Non-offensive buffs"].reduce((acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`, "");
                break;
            case "auxMisc":
                description = [...parts["Aux"], ...parts["Misc"]].reduce(
                    (acc, curr) => acc + `**${curr.name}**: ${curr?.description}\n`,
                    ""
                );
                break;
        }

        await interaction.update({ embeds: [{ title: "__Arguments List__", description }] });
    });
}

async function update(_: string, message: Message) {
    if (message?.author?.id === process.env.MASTER_USER || message === undefined) {
        const gitFetch = child_process.spawn("git", ["fetch"]);

        gitFetch.on("close", () => {
            const gitStatus = child_process.spawn("git", ["status", "-sb"]);

            let status = "";

            gitStatus.stdout.setEncoding("utf8");
            gitStatus.stdout.on("data", (data) => (status += data));

            gitStatus.on("close", () => {
                if (status.includes("behind")) {
                    let output = "```git pull```";

                    const gitPull = child_process.spawn("git", ["pull"]);

                    gitPull.stdout.setEncoding("utf8");
                    gitPull.stdout.on("data", (data) => (output += data));

                    gitPull.on("close", () => {
                        child_process.spawn("npm", ["ci"]).on("close", () => {
                            const build = child_process.spawn("npm", ["run", "build"]);

                            output += "```npm ci OK``````npm run build```";

                            build.stdout.setEncoding("utf-8");
                            build.stdout.on("data", (data) => (output += data));

                            build.on("close", () => {
                                fs.unlink(`${__dirname}/../assets/api-info.json`, (err) => {
                                    if (err) {
                                        message
                                            ? message.channel
                                                  .send({
                                                      embeds: [
                                                          {
                                                              title: "__Update complete__",
                                                              description: output + "**Could not delete `api-info.json`**",
                                                              color: 0x00fff0,
                                                          },
                                                      ],
                                                  })
                                                  .then(() => process.exit(0))
                                            : process.exit(0);
                                    }

                                    message
                                        ? message.channel
                                              .send({
                                                  embeds: [
                                                      {
                                                          title: "__Update complete__",
                                                          description: output + "**`api-info.json` deleted**",
                                                          color: 0x00ff00,
                                                      },
                                                  ],
                                              })
                                              .then(() => process.exit(0))
                                        : process.exit(0);
                                });
                            });
                        });
                    });
                } else if (status.includes("ahead")) {
                    message?.channel?.send({
                        embeds: [
                            {
                                description: "ERR: Local ahead of remote!",
                                color: 0xff0000,
                            },
                        ],
                    });
                } else {
                    message
                        ? message.channel.send({
                              embeds: [
                                  {
                                      description: "Already up to date.",
                                      color: 0x00f0ff,
                                  },
                              ],
                          })
                        : void 0;
                }
            });
        });
    }
}

async function updateNicknames(_: string, message: Message) {
    let output = "```";

    const updateNicknames = child_process.spawn("~/scripts/update-nicknames");

    updateNicknames.stdout.setEncoding("utf8");
    updateNicknames.stdout.on("data", (data) => (output += data));
    updateNicknames.stderr.on("data", (data) => (output += data));

    updateNicknames
        .on("close", () => {
            message
                ? message.channel
                      .send({
                          embeds: [
                              {
                                  title: "```Update nicknames```",
                                  description: output + "```\n**Nicknames updated**",
                                  color: 0xa0a0a0,
                              },
                          ],
                      })
                      .then(() => process.exit(0))
                : process.exit(0);
        })
        .on("error", (error) => {
            message
                ? message.channel
                      .send({
                          embeds: [
                              {
                                  title: "```Update nicknames```",
                                  description: output + error + "```\n**Could not update nicknames!**",
                                  color: 0xff2e2e,
                              },
                          ],
                      })
                      .then(() => process.exit(0))
                : process.exit(0);
        });
}

async function listNPs(args: string) {
    const { svt } = await getSvt(args.split(" ")[0]);

    const NPs = getNps(svt);

    return {
        embeds: [
            {
                title: `NPs for ${svt.name}`,
                description:
                    NPs.reduce((str, NP, snp) => {
                        return NP.npMultis.length
                            ? (str += `${emoji(NP.card.toLowerCase())} \`snp${snp}\`:\n${NP.npMultis.reduce(
                                  (str, multi, index) => (str += `**NP${index + 1}**: *${multi.slice(0, -2) + multi[multi.length - 1]}*\n`),
                                  ""
                              )}\n`)
                            : "";
                    }, "").trim() || "No NPs found.",
            },
        ],
    };
}

function wikia(search: string) {
    let document: Document;

    return new Promise((resolve) => {
        https.get(
            "https://www.google.com/search?q=site%3Afategrandorder.fandom.com+" + search.replace(/ /g, "+"),
            function (res: IncomingMessage) {
                let data = "";

                res.on("data", function (chunk: string) {
                    data += chunk;
                });

                res.on("end", () => {
                    document = new JSDOM(data, { pretendToBeVisual: true }).window.document;

                    let reply = "";

                    try {
                        reply =
                            "<" +
                            decodeURI(
                                decodeURI(
                                    (
                                        document.querySelector(
                                            'a[href^="/url?q=https://fategrandorder.fandom.com/wiki/"]'
                                        ) as HTMLAnchorElement
                                    ).href
                                        .slice(7)
                                        .split("&")[0]
                                )
                            ) +
                            ">";
                        resolve(reply);
                    } catch (err) {
                        resolve(
                            "Error finding result for <https://www.google.com/search?q=site%3Afategrandorder.fandom.com+" +
                                search.replace(/ /g, "+") +
                                ">"
                        );
                    }
                });
            }
        );
    });
}

async function db(search: string, message: Message) {
    const entities = getEntities(search);
    const colour = message.member?.displayHexColor ?? message.author.hexAccentColor ?? "#7070EE";

    // Filter out any non-servant if a servant with the same collectionNo is already present
    const filteredEntities = entities.filter((entity, entityNo, self) => {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isEntityServant = (svt: any) =>
            [
                Entity.EntityType.ENEMY,
                Entity.EntityType.ENEMY_COLLECTION,
                Entity.EntityType.ENEMY_COLLECTION_DETAIL,
                Entity.EntityType.HEROINE,
                Entity.EntityType.NORMAL,
            ].includes(svt.type);

        const isServantCollectionNoPresent = !!(
            entity.collectionNo === self.find((e) => e.collectionNo === entity.collectionNo && isEntityServant(e))?.collectionNo
        );

        if (!isEntityServant(entity)) {
            return !isServantCollectionNoPresent; // If a servant with the same C.No. is not present then include the entity
        }

        // If entity is a servant, include it
        return true;
    });

    const URLs = filteredEntities.map((entity, entityNo) => {
        const text = `(${entity.collectionNo === 0 ? entity.id : entity.collectionNo}) ${
            "className" in entity ? emoji(entity.className.toLowerCase()) : ""
        }**[${entity.name.replace("\n", " ")}]`;

        switch (entity.type as string) {
            case "normal":
            case "heroine":
                return entity.collectionNo === 0
                    ? `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/enemy/${entity.id})** (${entityTypeDescriptions.get(
                          entity.type
                      )})`
                    : `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/servant/${
                          entity.collectionNo
                      })** (${entityTypeDescriptions.get(entity.type)})`;
            case "servantEquip":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/craft-essence/${
                    entity.collectionNo
                })** (${entityTypeDescriptions.get(entity.type)})`;
            case "enemy":
            case "enemyCollection":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/enemy/${entity.id})** (${entityTypeDescriptions.get(
                    entity.type
                )})`;
            case "enemyCollectionDetail":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/servant/${
                    entity.id
                })** (${entityTypeDescriptions.get(entity.type)})`;
            case "commandCode":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/command-code/${
                    entity.id
                })** (${entityTypeDescriptions.get(entity.type)})`;
            case "mysticCode":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/mystic-code/${
                    entity.id
                })** (${entityTypeDescriptions.get(entity.type)})`;
            case "war":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/war/${entity.id})** (${entityTypeDescriptions.get(
                    entity.type
                )})`;
            case "event":
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/event/${entity.id})** (${entityTypeDescriptions.get(
                    entity.type
                )})`;
            default:
                return `**${entityNo + 1}.** ${text}(https://apps.atlasacademy.io/db/JP/enemy/${entity.id})** (${entityTypeDescriptions.get(
                    entity.type
                )})`;
        }
    });

    return { embeds: [{ title: `Search results for query \`${search}\``, description: URLs.join("\n"), color: colour }] };
}

function lolwiki(search: string) {
    let document: Document;

    return new Promise((resolve) => {
        https.get(
            "https://www.google.com/search?q=site%3Aleagueoflegends.fandom.com/+" + search.replace(/ /g, "+"),
            function (res: IncomingMessage) {
                let data = "";

                res.on("data", function (chunk: string) {
                    data += chunk;
                });

                res.on("end", () => {
                    document = new JSDOM(data, { pretendToBeVisual: true }).window.document;

                    let reply = "";

                    try {
                        reply =
                            "<" +
                            decodeURI(
                                decodeURI(
                                    (
                                        document.querySelector(
                                            'a[href^="/url?q=https://leagueoflegends.fandom.com/wiki/"]'
                                        ) as HTMLAnchorElement
                                    ).href
                                        .slice(7)
                                        .split("&")[0]
                                )
                            ) +
                            ">";
                        resolve(reply);
                    } catch (err) {
                        resolve(
                            "Error finding result for <https://www.google.com/search?q=site%3Aleagueoflegends.fandom.com/+" +
                                search.replace(/ /g, "+") +
                                ">"
                        );
                    }
                });
            }
        );
    });
}

function bing(search: string) {
    let document: Document;

    return new Promise((resolve) => {
        https.get("https://www.bing.com/search?q=" + search.replace(/ /g, "+"), function (res: IncomingMessage) {
            let data = "";

            res.on("data", function (chunk: string) {
                data += chunk;
            });

            res.on("end", () => {
                ({ document } = new JSDOM(data, { pretendToBeVisual: true }).window);

                let reply = "";

                try {
                    reply =
                        "<" +
                        decodeURI(decodeURI((document.querySelector('main[aria-label="Search Results"] h2 a') as HTMLAnchorElement).href)) +
                        ">";
                    resolve(reply);
                } catch (err) {
                    resolve("Error finding result for <https://www.bing.com/search?q=" + search.replace(/ /g, "+") + ">");
                }
            });
        });
    });
}

async function calc(expr: string) {
    return math.evaluate(expr.replace(",", "")) + "";
}

function hong(_: string, message: Message) {
    const title = "__FGO Follow Solos/Cheap Clears for Main Story__";

    const description =
        "* [Camelot Super Orion Solos](https://www.youtube.com/playlist?list=PLfKiA4IXdP7j_hZbDgKoGNnKUhR72eOkw)\n\u200B" +
        "* [Hong's Solos: Part 1 & Part 2 up to LB4](https://www.youtube.com/playlist?list=PLVw95Imz4v-nkX-LKD6tE3NJSwGAQpyT8)\n\u200B" +
        "* [LB3 Billi Solos](https://www.bilibili.com/video/av80276537)\n\u200B" +
        "* [LB 5.1 Atlantis Solos](https://www.bilibili.com/video/av80130220)\n\u200B" +
        "* [LB 5.2 Olympus Solos](https://www.bilibili.com/video/BV1LK4y1m7wK)\n\u200B" +
        "* [LB 5.5 Heian-Kyō Solos](https://www.youtube.com/playlist?list=PLfKiA4IXdP7iqWz2aVE-U5vepMoSBjSK7)\n\u200B" +
        "\n\u200B__Bonus__\n\u200B" +
        "* [Guide on cheesing hard quests with friend/follow support servants](https://docs.google.com/document/d/13ZkaWVM7miK2RqwY-uvr6jTjZntXhmiEmG77TttC61Y/preview)\n\u200B" +
        "* [Hong's mostly F2P FQ & Daily Farming Setups (90+ not included)](https://www.youtube.com/playlist?list=PLVw95Imz4v-kNhqIPqrN0nLautNhQAhrn)\n\u200B";

    return {
        embeds: [{ title, description, color: message.member?.displayHexColor ?? message.author.hexAccentColor ?? "#7070EE" }],
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commands = new Map<string, (args: string, message: Message) => any>()
    .set("test", test)
    .set("t", test)
    .set("help", help)
    .set("h", help)
    .set("list", listNPs)
    .set("l", listNPs)
    .set("getnps", listNPs)
    .set("nps", listNPs)
    .set("wikia", wikia)
    .set("wiki", wikia)
    .set("w", wikia)
    .set("lolwiki", lolwiki)
    .set("lw", lolwiki)
    .set("google", bing)
    .set("bing", bing)
    .set("search", bing)
    .set("s", bing)
    .set("calculate", calc)
    .set("calc", calc)
    .set("c", calc)
    .set("evaluate", calc)
    .set("eval", calc)
    .set("e", calc)
    .set("math", calc)
    .set("m", calc)
    .set("getnames", getNames)
    .set("names", getNames)
    .set("g", getNames)
    .set("addname", addName)
    .set("name", addName)
    .set("a", addName)
    .set("db", db)
    .set("d", db)
    .set("aa", db)
    .set("lookup", () => "<https://apps.atlasacademy.io/drop-lookup>")
    .set("dropsheet", () => "<https://docs.google.com/spreadsheets/u/1/d/1_SlTjrVRTgHgfS7sRqx4CeJMqlz687HdSlYqiW-JvQA>")
    .set("drops", () => "<https://docs.google.com/spreadsheets/d/1NY7nOVQkDyWTXhnK1KP1oPUXoN1C0SY6pMEXPcFuKyI/htmlview?fws=true>")
    .set("bond", () => "<https://docs.google.com/spreadsheets/d/1DgecX3EzUM72cSHs0d9s1gVzJ-MGm7d-uRX9H8NvHtk>")
    .set("submissions", () => "<https://apps.atlasacademy.io/drop-serializer/>")
    .set("interludes", () => "<https://docs.google.com/spreadsheets/d/1MYHZ6rRMlLgjAxZ3HUMnSYHZA4rMdx614G-94dLEtcU>")
    .set("ludes", () => "<https://docs.google.com/spreadsheets/d/1MYHZ6rRMlLgjAxZ3HUMnSYHZA4rMdx614G-94dLEtcU>")
    .set("npdmg", () => "<https://docs.google.com/spreadsheets/d/1p1OSVrIZ37eV-ttzZgZdyADTGXiFLP7JtBFdzh1TFIo/edit?usp=sharing>")
    .set("npdmgjp", () => "<https://docs.google.com/spreadsheets/d/1OTrMARN9I06zD_jIhGdmHFWpkePoSWv_xgEk3XPzZWY>")
    .set("time", () => "<https://www.mitsunee.com/fgo/time/>")
    .set("jptimer", () => "<https://fgojunks.max747.org/timer/>")
    .set("refunddemo", () => "<https://docs.google.com/document/d/1_Bx1FogTrMBnseIJLT4Vuob7DY7EfR6H_SobGwxcAFE>")
    .set(
        "buffcaps",
        () => `https://cdn.discordapp.com/attachments/858811701771370496/867380149993472010/Screenshot_2021-07-21_Untitled_spreadsheet1.png`
    )
    .set("chargers", () => "<https://apps.atlasacademy.io/chargers>")
    .set("ce", () => "<https://docs.google.com/spreadsheets/d/1o0beLBAx_eAgAQgujF7DEZIgDlQfVlRLs33e97sfGAY/htmlview>")
    .set("upgrades", () => "<https://fgo.mitsunee.com/upgrades>")
    .set("appends", () => "<https://docs.google.com/spreadsheets/d/1mMu40M_wr_C9LGKClziHl-zcxTpnNBYDEMOjMljersI/htmlview>")
    .set("rp", () => "<https://docs.google.com/document/d/141qKthFGFe5I5AMOIMBU5j_-Pkutiw-g9NTZKwPYl6k>")
    .set("cost", () => "https://i.imgur.com/a1PNMJQ.jpg")
    .set("buffs", () => "https://i.imgur.com/LYOMBoX.png")
    .set("npse", () => "https://i.imgur.com/zOAeaU4.png")
    .set("nptimes", () => "<https://appmedia.jp/fategrandorder/75154356>")
    .set("sos", () => "<https://docs.google.com/document/d/1FU8UkUfgw4rgXbhOomt4Vqgg4Mk1UnuZp8dQM9K1EdY>")
    .set("sosjp", () => "<https://docs.google.com/document/d/1ZQb6d6iT616BjCrCafVUyAmyulZq-IqbgCCszlJglJw/edit>")
    .set("compendium", () => "<https://docs.google.com/spreadsheets/d/1qvxLU407QwiFaCvItqR16SqqAVlLD5u5nBzY_bCFYvs>")
    .set("forecast", () => "<https://docs.google.com/spreadsheets/d/1m-h4CIUOKaJRAmfTAhoDdmwVAzAzyM70cITRb36Y96M>")
    .set("papermoon", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("limited", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("limiteds", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("banners", () => "<https://docs.google.com/spreadsheets/d/1rKtRX3WK9ZpbEHhDTy7yGSxYWIav1Hr_KhNM0jWN2wc/edit>")
    .set("efficiency", () => "<https://docs.google.com/spreadsheets/d/1jxcPru2BrdZuq-zCK4UL2fvPuOKxFotCdJTCYz-uo94>")
    .set("howtosave", () => "<https://docs.google.com/document/d/1OCrbeQbwXSHYSYgAaSt4FiKUekcW2x_ybVNNt9LHGDU/>")
    .set(
        "shishoufest",
        () => "<https://fategrandorder.fandom.com/wiki/User_blog:Ratentaisou/NA_Dance_Tournament_in_the_Land_of_Shadows_2022_Video_Archive>"
    )
    .set(
        "scathfest",
        () => "<https://fategrandorder.fandom.com/wiki/User_blog:Ratentaisou/NA_Dance_Tournament_in_the_Land_of_Shadows_2022_Video_Archive>"
    )
    .set(
        "hagfest",
        () => "<https://fategrandorder.fandom.com/wiki/User_blog:Ratentaisou/NA_Dance_Tournament_in_the_Land_of_Shadows_2022_Video_Archive>"
    )
    .set("karnamas", () => "<https://fategrandorder.fandom.com/wiki/User_blog:Ratentaisou/NA_Christmas_2022_Video_Archive>")
    .set("xmas6", () => "<https://fategrandorder.fandom.com/wiki/User_blog:Ratentaisou/NA_Christmas_2022_Video_Archive>")
    .set("beginners", () => "<https://docs.google.com/document/d/1XlYhSDrrDo5_QlAbNICLQ4USnXiRwMFtjbHo_p6ZSSM/>")
    .set("beginner", () => "<https://docs.google.com/document/d/1XlYhSDrrDo5_QlAbNICLQ4USnXiRwMFtjbHo_p6ZSSM/>")
    .set("starters", () => "<https://docs.google.com/document/d/18Gqs-G320ySwrdBMhearMCNj8E73d6uPvEwVMV_3Cx8>")
    .set("ticket", () => "<https://docs.google.com/document/d/1XCOagFQEUjGAYHczy5A7rtmePZs5dEsfxUEnkQ8BObE>")
    .set(
        "blueprism",
        () =>
            "Introduced with the JP 22M DL Campaign, Blue Prisms function equivalently to a 3 CS/1 quartz revive. They have an expiration date tied to them and are restricted to main story content. They can be obtained through campaigns (both directly and through MP shop purchases)."
    )
    .set(
        "lottery",
        () => `__**What are lotto (lottery) events?**__\n\u200B
    Lotto events are specific events that feature a unique system of mat rewards in the form of a __**lottery wheel/roulette**__ which pulls from a __**box**__ that has a set of predetermined goodies in them, such as mats, QP, gems, exp, etc available at a very ap-efficient rate. The boxes are rolled with a specific event lottery currency that you obtain alongside the standard shop currencies. Once a box has been completely cleared out of items the box can be __**reset**__, replenishing all of the mats and other items within it.\n\u200B
    The reason why lottos are so highly anticipated is because there is __**no limit to the number of times you can reset the box**__ (note that reruns often have limited resets). This is why it is frequently recommended to both save a majority of one's apples for lottos, and to focus on putting together farming teams that clear the best lotto currency nodes in as few turns as possible to speed up the grind.`
    )
    .set(
        "lotto",
        () => `__**What are lotto (lottery) events?**__\n\u200B
    Lotto events are specific events that feature a unique system of mat rewards in the form of a __**lottery wheel/roulette**__ which pulls from a __**box**__ that has a set of predetermined goodies in them, such as mats, QP, gems, exp, etc available at a very ap-efficient rate. The boxes are rolled with a specific event lottery currency that you obtain alongside the standard shop currencies. Once a box has been completely cleared out of items the box can be __**reset**__, replenishing all of the mats and other items within it.\n\u200B
    The reason why lottos are so highly anticipated is because there is __**no limit to the number of times you can reset the box**__ (note that reruns often have limited resets). This is why it is frequently recommended to both save a majority of one's apples for lottos, and to focus on putting together farming teams that clear the best lotto currency nodes in as few turns as possible to speed up the grind.`
    )
    .set(
        "welfarerp",
        () =>
            "Copies 6 to 10 of welfare servants __acquired during or after the 2020 Santa Altera rerun__ will each give 1 RP upon acquisition, __automatically arriving in your present box__ - burning not required.\n\u200B\n**Any welfare servants acquired prior to that rerun will not give RP.**"
    )
    .set(
        "coins",
        () => `**Regarding Append and level 120 Grail coin cost:**
    - Every servant has 3 new passive skills. Each passive skill costs 120 coins to unlock (360 total).
    - Every grail past level 100 is 2 levels. Each one also costs 30 coins. So going 100>120 requires 300 coins.\n\u200B
**Bond-related rewards (retroactive for all):**
    Bond 1-6 = 5 coins each (30 total)
    Bond 7-9 = 10 coins each (30 total)
    Bond 10-15 = 20 coins each (120 total)\n\u200B
**NP level rewards (only retroactive for non-welfare golds):**
    SSR: 90 coins per NP level
    Limited/Storylock SRs/Angra: 50 coins per NP level
    Permanent SRs: 30 coins per NP level
    Limited/Story-locked 3s: 30 coins per NP level
    Permanent 3s/Limited 1s: 15 coins per NP level
    2s: 6 coins per NP level
    1*s: 2 coins per NP level\n\u200B
__Servant Coin Calculator for the lazy:__
    <https://r-grandorder.github.io/fgo-guides/references/coins_calculator.html>`
    )
    .set("glossary", () => "<https://atlasacademy.io/fgo-glossary/>")
    .set("starz", () => "<https://apps.atlasacademy.io/db/NA/servant/Mozart>")
    .set("refund", () => "https://imgur.com/lO1UGGU")
    .set("junao", () => ({
        embeds: [
            {
                title: "Junao/Waver",
                description: "https://imgur.com/IAYH9Vb",
            },
            {
                title: "Junao/Merlin",
                description: "https://imgur.com/eA0YLIQ",
            },
        ],
    }))
    .set("commands", () => {
        let replyDesc = "__**Bot Commands**__\n";

        for (const [key, value] of botCommandsMap) {
            replyDesc += `**${key}** - ${value}\n`;
        }

        replyDesc += "\u200B\n__**Various Resources**__\n";

        for (const [key, value] of resourceCommandsMap) {
            replyDesc += `**${key}** - ${value}\n`;
        }

        replyDesc += "\u200B\n__**Forecast Resources**__\n";

        for (const [key, value] of forecastResourcesCommandsMap) {
            replyDesc += `**${key}** - ${value}\n`;
        }

        replyDesc += "\u200B\n__**Beginner Resources**__\n";

        for (const [key, value] of beginnerResourcesCommandsMap) {
            replyDesc += `**${key}** - ${value}\n`;
        }

        return {
            embeds: [
                {
                    title: "__**Commands**__",
                    description: replyDesc,
                },
            ],
        };
    })
    .set("hong", hong)
    .set("solo", hong)
    .set("solos", hong)
    .set("soloes", hong)
    .set("liz", (_, message) => {
        if (message.author.id === process.env.MASTER_USER) {
            fs.unlink(`${__dirname}/../assets/api-info.json`, (err) => {
                if (err) {
                    message
                        ? message.channel
                              .send({
                                  embeds: [
                                      {
                                          description: "Could not delete `api-info.json`. Died anyway",
                                          color: 0x00fff0,
                                      },
                                  ],
                              })
                              .then(() => process.exit(5))
                        : process.exit(5);

                    return;
                }

                message
                    ? message.channel
                          .send({
                              embeds: [
                                  {
                                      description: "`api-info.json` deleted. Dying successfully.",
                                      color: 0x00f0ff,
                                  },
                              ],
                          })
                          .then(() => process.exit(5))
                    : process.exit(5); // WARN
            });
        }
    })
    .set("update", update)
    .set("update-nicknames", updateNicknames)
    .set("nicks", updateNicknames);

// Call update every 15 minutes
setInterval(update, 15 * 60 * 1000);

export { commands };
