import { calcSvt, CalcVals, ChainCalcVals, EnemyCalcVals, cmdArgs, getNps, init } from "fgo-calc";
import { emoji, nicknames } from "../assets/assets";
import { getSvt } from "../helpers/svt";
import { getCardEmbeds, getChainEmbeds, getEnemyEmbeds } from "../helpers/embeds";
import { Message } from "discord.js";
import https from "https";
import { JSDOM } from "jsdom";
import { create, all } from "mathjs";
import fs from "fs";
import { ApiConnector, Entity, Language, Region } from "@atlasacademy/api-connector";

const math = create(all, {});
const apiConnector = new ApiConnector({ host: "https://api.atlasacademy.io", region: Region.JP, language: Language.ENGLISH });
const NAApiConnector = new ApiConnector({ host: "https://api.atlasacademy.io", region: Region.NA, language: Language.ENGLISH });

const entityTypeDescriptions = new Map<Entity.EntityType, string>([
    [Entity.EntityType.NORMAL, "Servant"],
    [Entity.EntityType.HEROINE, "Servant (Mash)"],
    [Entity.EntityType.COMBINE_MATERIAL, "Exp Card"],
    [Entity.EntityType.ENEMY, "Enemy"],
    [Entity.EntityType.ENEMY_COLLECTION, "Enemy Servant"],
    [Entity.EntityType.ENEMY_COLLECTION_DETAIL, "Boss"],
    [Entity.EntityType.SERVANT_EQUIP, "Craft Essence"],
    [Entity.EntityType.STATUS_UP, "Fou Card"],
]);

const botCommandsMap = new Map<string, string>()
    .set("test (t)", "Calculate servant/enemy cards")
    .set("help (h)", "Help for !test")
    .set("getnames (g, names)", "Get nicknames for a servant")
    .set("getnps (list, l, nps)", "List servant NPs")
    .set("math(m)/calculate(calc, c)/evaluate(eval, e)", "Evaluate mathematical expression")
    .set("db (aa)", "Search aa-db for entity, for instance to get the ID /C.No. to calc with")
    .set("wikia (w)", "Search F/GO wikia using google")
    .set("google (bing, search, s)", "Search query with bing")
    .set("lolwiki (lw)", "Search LoL wikia using google")
    .set("junao", "Own/Borrowed junao+waver|merlin calc")
    .set("commands", "Haha recursion");

const resourceCommandsMap = new Map<string, string>()
    .set("lookup", "Look up where to farm a material (references the dropsheets)")
    .set("dropsheet", "Lists the top 5 farming nodes for non-event mats (based on drop rate as well as AP/drop)")
    .set("drops", "Slightly cooler and less mobile-friendly version of the dropsheet")
    .set("submissions", "Sit to submit your drop results of free quests for the dropsheet")
    .set("interludes (ludes)", "Lists the materials gained from interludes and rank up quests")
    .set("npdmg", "NP damage table for NA")
    .set("npdmgjp", "NP damage table for JP")
    .set("buffcaps", "View the possiblerange of different (de)buffs")
    .set("chargers", "Lists of NP batteries on servants")
    .set("sos", "Account recovery guide (NA)")
    .set("sosjp", "Account recovery guide (JP)");

//A Google Spreadsheet that contains list of limited items, material tickets, and event farming drop data for the game Fate/Grand Order

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

const beginnerResourcesCommandsMap = new Map<String, string>()
    .set("beginners (beginner)", "Beginner's guide to FGO")
    .set("starters", "Recommended servants to raise for beginners")
    .set("solo", "Guide on cheesing hard quests with support servants")
    .set("hong", "Video playlist of friend soloing main story")
    .set("ticket", "Recommended servants to pick from the NA 17M DL campaign SSR ticket")
    .set("lottery", "Explanation on lottery events")
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
        let id = Object.keys(nicknames).find((id) => nicknames[id].includes(servant))!;
        let names = nicknames[id];

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
    let reply = "";

    if (process.env.AUTH_USERS!.includes(message.author.id)) {
        let [id, ...nicknameWords] = str.split(" ");

        const nickname = nicknameWords.join(" ");

        if (!(id in nicknames)) {
            nicknames[id] = [];
        }

        if (!nicknames[id].includes(nickname)) {
            nicknames[id].push(nickname);
            fs.writeFileSync("./src/assets/nicknames.json", JSON.stringify(nicknames, null, 2));
            reply = `Set ${id}: ${nickname}`;
            console.log(`Set ${id}: ${nickname}`);
        } else {
            reply = `[${id}: "${nickname}"] already exists!`;
        }
    }

    return reply;
}

async function test(args: string) {
    let argStr: string, svtName: string;

    svtName = args.split(" ")[0];
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
        https.get("https://www.google.com/search?q=site%3Afategrandorder.fandom.com+" + search.replace(/ /g, "+"), function (res: any) {
            let data = "";

            res.on("data", function (chunk: any) {
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
                                    document.querySelector('a[href^="/url?q=https://fategrandorder.fandom.com/wiki/"]') as HTMLAnchorElement
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
        });
    });
}

async function db(search: string) {
    const entities = await apiConnector.searchEntity({ name: search });

    const URLs = entities.map((entity, entityNo) => {
        const text = `[(${entity.collectionNo === 0 ? entity.id : entity.collectionNo})${emoji(entity.className)}**${
            entity.name
        }** (${entityTypeDescriptions.get(entity.type)})]`;

        switch (entity.type) {
            case Entity.EntityType.NORMAL:
            case Entity.EntityType.HEROINE:
                return entity.collectionNo === 0
                    ? `${entityNo + 1}. ${text}(https://apps.atlasacademy.io/db/JP/enemy/${entity.id})`
                    : `${entityNo + 1}. ${text}(https://apps.atlasacademy.io/db/JP/servant/${entity.collectionNo})`;
            case Entity.EntityType.SERVANT_EQUIP:
                return `${entityNo + 1}. ${text}(https://apps.atlasacademy.io/db/JP/craft-essence/${entity.collectionNo})`;
            case Entity.EntityType.ENEMY:
            case Entity.EntityType.ENEMY_COLLECTION:
            case Entity.EntityType.ENEMY_COLLECTION_DETAIL:
                return `${entityNo + 1}. ${text}(https://apps.atlasacademy.io/db/JP/enemy/${entity.id})`;
        }
        return "";
    });

    return { embeds: [{ title: `Search results for query \`${search}\``, description: URLs.join(",\n") }] };
}

function lolwiki(search: string) {
    let document: Document;

    return new Promise((resolve) => {
        https.get("https://www.google.com/search?q=site%3Aleagueoflegends.fandom.com/+" + search.replace(/ /g, "+"), function (res: any) {
            let data = "";

            res.on("data", function (chunk: any) {
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
        });
    });
}

function bing(search: string) {
    let document: Document;

    return new Promise((resolve) => {
        https.get("https://www.bing.com/search?q=" + search.replace(/ /g, "+"), function (res: any) {
            let data = "";

            res.on("data", function (chunk: any) {
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
    return math.evaluate(expr) + "";
}

const commands = new Map<string, Function>()
    .set("test", test)
    .set("t", test)
    .set("help", help)
    .set("h", help)
    .set("list", listNPs)
    .set("l", listNPs)
    .set("getnps", listNPs)
    .set("nps", listNPs)
    .set("wikia", wikia)
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
    .set("aa", db)
    .set("lookup", () => "<https://apps.atlasacademy.io/drop-lookup>")
    .set("dropsheet", () => "<https://docs.google.com/spreadsheets/u/1/d/1_SlTjrVRTgHgfS7sRqx4CeJMqlz687HdSlYqiW-JvQA>")
    .set("drops", () => "<https://docs.google.com/spreadsheets/d/1NY7nOVQkDyWTXhnK1KP1oPUXoN1C0SY6pMEXPcFuKyI/edit#gid=666129902>")
    .set("submissions", () => "<https://apps.atlasacademy.io/drop-serializer/>")
    .set("interludes", () => "<https://docs.google.com/spreadsheets/d/1MYHZ6rRMlLgjAxZ3HUMnSYHZA4rMdx614G-94dLEtcU>")
    .set("ludes", () => "<https://docs.google.com/spreadsheets/d/1MYHZ6rRMlLgjAxZ3HUMnSYHZA4rMdx614G-94dLEtcU>")
    .set("npdmg", () => "<https://docs.google.com/spreadsheets/d/1p1OSVrIZ37eV-ttzZgZdyADTGXiFLP7JtBFdzh1TFIo/edit?usp=sharing>")
    .set("npdmgjp", () => "<https://docs.google.com/spreadsheets/d/1OTrMARN9I06zD_jIhGdmHFWpkePoSWv_xgEk3XPzZWY>")
    .set(
        "buffcaps",
        () => `https://cdn.discordapp.com/attachments/858811701771370496/867380149993472010/Screenshot_2021-07-21_Untitled_spreadsheet1.png`
    )
    .set("chargers", () => "<https://apps.atlasacademy.io/chargers>")
    .set("sos", () => "<https://docs.google.com/document/d/1FU8UkUfgw4rgXbhOomt4Vqgg4Mk1UnuZp8dQM9K1EdY>")
    .set("sosjp", () => "<https://docs.google.com/document/d/1ZQb6d6iT616BjCrCafVUyAmyulZq-IqbgCCszlJglJw/edit>")
    .set("compendium", () => "<https://docs.google.com/spreadsheets/d/1qvxLU407QwiFaCvItqR16SqqAVlLD5u5nBzY_bCFYvs>")
    .set("forecast", () => "<https://docs.google.com/spreadsheets/d/1m-h4CIUOKaJRAmfTAhoDdmwVAzAzyM70cITRb36Y96M>")
    .set("papermoon", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("limited", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("limiteds", () => "<https://docs.google.com/spreadsheets/d/1hc4V7gqp_JqsC183RmNi3dUeLyLPyprdiECA7nOwo6w/edit#gid=184815061>")
    .set("banners", () => "<https://docs.google.com/spreadsheets/d/1rKtRX3WK9ZpbEHhDTy7yGSxYWIav1Hr_KhNM0jWN2wc/edit>")
    .set("efficiency", () => "<https://docs.google.com/spreadsheets/d/1jxcPru2BrdZuq-zCK4UL2fvPuOKxFotCdJTCYz-uo94>")
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
    .set("solo", () => "<https://docs.google.com/document/d/13ZkaWVM7miK2RqwY-uvr6jTjZntXhmiEmG77TttC61Y>")
    .set("hong", () => "<https://www.youtube.com/playlist?list=PLVw95Imz4v-nkX-LKD6tE3NJSwGAQpyT8>")
    .set("ticket", () => "<https://docs.google.com/document/d/1XCOagFQEUjGAYHczy5A7rtmePZs5dEsfxUEnkQ8BObE>")
    .set(
        "lottery",
        () => `__**What are lotto (lottery) events?**__\n\u200B
    Lotto events are specific events that feature a unique system of mat rewards in the form of a __**lottery wheel/roulette**__ which pulls from a __**box**__ that has a set of predetermined goodies in them, such as mats, QP, gems, exp, etc available at a very ap-efficient rate. The boxes are rolled with a specific event lottery currency that you obtain alongside the standard shop currencies. Once a box has been completely cleared out of items the box can be __**reset**__, replenishing all of the mats and other items within it.\n\u200B
    The reason why lottos are so highly anticipated is because there is __**no limit to the number of times you can reset the box**__ (note that reruns often have limited resets). This is why it is frequently recommended to both save a majority of one's apples for lottos, and to focus on putting together farming teams that clear the best lotto currency nodes in as few turns as possible to speed up the grind.`
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
    });

export { commands };
