import { EmbedField } from "discord.js";
import { CalcVals, ChainCalcVals, EnemyCalcVals } from "fgo-calc";
import { emoji } from "../assets/assets";

const getCardEmbeds = (vals: CalcVals) => {
    if (vals.calcTerms.enemyHp !== undefined) {
        return { embeds: [getCardNPStarEmbed(vals), ...getCardDamageEmbeds(vals)], type: "card" };
    } else {
        return { embeds: [...getCardDamageEmbeds(vals)], type: "card" };
    }
};

const getCardDamageEmbeds = (vals: CalcVals) => {
    const BaseStats = {
            "Base ATK": vals.calcTerms.servantAtk - vals.calcTerms.fou - vals.calcTerms.fouPaw - vals.calcTerms.ce,
            "Fou + Paw ATK": vals.calcTerms.fou + vals.calcTerms.fouPaw,
            "CE ATK": vals.calcTerms.ce,
            Level: vals.calcTerms.level,
            "NP Level": (vals.calcTerms.strengthen ? emoji("nplewd") : emoji("nolewd")) + " " + vals.calcTerms.npLevel,
            "Class Attack Rate": vals.calcTerms.classAtkBonus,
            "Triangle Modifier": vals.calcTerms.triangleModifier,
            "Attribute Modifier": vals.calcTerms.attributeModifier,
            "Card Damage Value": vals.calcTerms.faceCard
                ? emoji(vals.calcTerms.cardName) + " " + vals.calcTerms.cardDamageValue * 100 + "%"
                : emoji("nplewd") + " " + vals.calcTerms.npDamageMultiplier * 100 + "%",
        },
        BaseVals = {
            "Card Mod": emoji("avatar") + " " + vals.calcTerms.cardMod * 100 + "%",
            "ATK Mod": emoji("charisma") + " " + vals.calcTerms.atkMod * 100 + "%",
            "DEF Mod": emoji("defup") + " " + vals.calcTerms.defMod * 100 + "%",
            "NP Mod": emoji("npmod") + " " + vals.calcTerms.npDamageMod * 100 + "%",
            "Supereffective Mod": emoji("semod") + " " + (1 + vals.calcTerms.superEffectiveModifier) + "x",
            "Power Mod": emoji("pmod") + " " + vals.calcTerms.powerMod * 100 + "%",
            "Crit Damage Mod": emoji("crit") + " " + vals.calcTerms.critDamageMod * 100 + "%",
            "Flat Damage": emoji("divinity") + " " + vals.calcTerms.dmgPlusAdd,
            ...(vals.damageFields.rngToKill ? { "Minimum Kill Roll": emoji("hits") + " " + vals.damageFields.rngToKill } : {}),
        };

    const BaseStatsVals = { ...BaseStats, ...BaseVals };

    const __description = Object.keys(BaseStats).reduce(
        (descStr, currKey) =>
            descStr +
            (+(BaseStats[currKey as keyof typeof BaseStats] + "").replace(/(<.*>)|[^0-9.%]/g, "")
                ? `**${currKey}:** ${BaseStats[currKey as keyof typeof BaseStats]}\n`
                : ""),
        ""
    );

    const __description2 = Object.keys(BaseVals).reduce((descStr, currKey) => {
        let addStr = " ";

        if (currKey === "Minimum Kill Roll") {
            addStr = BaseVals[currKey as keyof typeof BaseVals]?.split(" ")?.reverse()?.[0] ?? "";
        }

        if ((currKey as keyof typeof BaseVals) === "Supereffective Mod") {
            addStr = +BaseVals["Supereffective Mod"].replace(/\D/g, "") - 1 ? BaseVals["Supereffective Mod"] : " ";
        } else {
            addStr = +(BaseVals[currKey as keyof typeof BaseVals]?.split(" ")?.reverse()?.[0]?.replace(/\D/g, "") ?? false)
                ? `**${currKey}:** ${BaseVals[currKey as keyof typeof BaseVals]}`
                : " ";
        }

        return descStr + addStr + "\n";
    }, "");

    const verboseFields = [];

    for (const [key, value] of Object.entries({ ...BaseStatsVals })) {
        verboseFields.push({ name: key, value: value + "", inline: true });
    }

    if (vals.generalFields.warnMessage.trim().length) {
        verboseFields.push({ name: "Warnings", value: `⚠️ ${vals.generalFields.warnMessage}`, inline: false });
    }

    const embeds = [
        {
            title: `DMG for ${emoji(vals.generalFields.servantClass.toLowerCase())} ${vals.generalFields.servantName}`,
            url: vals.generalFields.servantURL,
            thumbnail: { url: vals.generalFields.servantThumbnail },
            description:
                `${emoji("hits")} **${vals.damageFields.damage.toLocaleString("en-US")}** (${vals.damageFields.minrollDamage.toLocaleString(
                    "en-US"
                )} ~ ${vals.damageFields.maxrollDamage.toLocaleString("en-US")})` +
                (vals.generalFields.warnMessage.trim().length ? `\n\n⚠️ ${vals.generalFields.warnMessage}` : ""),
            name: "damage",
            footer: { text: vals.calcTerms.isEnemy ? `${vals.calcTerms.servantName} (Enemy)` : `${vals.calcTerms.servantName} (Player)` },
        },
        {
            title: `DMG for ${emoji(vals.generalFields.servantClass.toLowerCase())} ${vals.generalFields.servantName} using`,
            url: vals.generalFields.servantURL,
            thumbnail: { url: vals.generalFields.servantThumbnail },
            fields: verboseFields as EmbedField[],
            description: `${emoji("hits")} **${vals.damageFields.damage.toLocaleString(
                "en-US"
            )}** (${vals.damageFields.minrollDamage.toLocaleString("en-US")} ~ ${vals.damageFields.maxrollDamage.toLocaleString("en-US")})`,
            name: "verboseDamage",
            __description,
            __description2,
            footer: { text: vals.calcTerms.isEnemy ? `${vals.calcTerms.servantName} (Enemy)` : `${vals.calcTerms.servantName} (Player)` },
        },
    ];

    if (vals.calcTerms.verbosity.length > 0 && vals.calcTerms.verbosity !== "nv") {
        return [embeds[1], embeds[0]];
    }

    return embeds;
};

const getCardNPStarEmbed = (vals: CalcVals) => {
    const NPStarStats = {
            "Base NP Gain": emoji("npgen") + " " + (vals.calcTerms.offensiveNPRate / 100).toFixed(2) + "%",
            "Base Star Gen": emoji("instinct") + " " + (vals.calcTerms.baseStarRate * 100).toFixed(2) + "%",
            "Enemy Server Mod": emoji(vals.calcTerms.enemyClass.toLowerCase()) + " " + vals.calcTerms.enemyServerMod,
            "Enemy Server Rate": emoji(vals.calcTerms.enemyClass.toLowerCase()) + " " + vals.calcTerms.serverRate.toFixed(2),
            "Card Damage Value": `${emoji(!vals.calcTerms.faceCard ? "nplewd" : vals.calcTerms.cardName ?? "")} ${
                vals.calcTerms.faceCard ? " " + vals.calcTerms.cardDamageValue + "x" : " " + vals.calcTerms.npDamageMultiplier * 100 + "%"
            }`,
        },
        NPStarBuffs = {
            "Arts First": emoji("artsfirst") + " " + vals.calcTerms.artsFirst,
            "Quick First": emoji("quickfirst") + " " + vals.calcTerms.quickFirst,
            Critical: emoji("crit") + " " + vals.calcTerms.isCritical,
            "Card Refund Value": emoji("npbattery") + " " + vals.calcTerms.cardNPValue,
            "Card Star Value": emoji("starrateup") + " " + vals.calcTerms.cardStarValue.toFixed(2),
            "NP Gain Mod": emoji("npgen") + " " + vals.calcTerms.npChargeRateMod,
            "Star Drop Mod": emoji("stargen") + " " + vals.calcTerms.starDropMod,
        },
        repeatedFields = {
            "Card Mod": emoji("avatar") + " " + vals.calcTerms.cardMod,
            "Damage range": `${emoji("hits")} [\`${vals.damageFields.minrollDamage.toLocaleString(
                "en-US"
            )}\`, \`${vals.damageFields.maxrollDamage.toLocaleString("en-US")}\`]`,
        };

    const NPStarVals = { ...NPStarStats, ...NPStarBuffs, ...repeatedFields };

    const description2 = Object.keys(NPStarVals).reduce(
        (descStr, currKey) =>
            descStr +
            (+(NPStarVals[currKey as keyof typeof NPStarVals] + "").replace(/(<.*>)|[^0-9.%]/g, "")
                ? `**${currKey}:** ${NPStarVals[currKey as keyof typeof NPStarVals]}\n`
                : ""),
        ""
    );

    const __description = Object.keys({ ...NPStarBuffs }).reduce(
        (descStr, currKey) =>
            descStr +
            (+(NPStarBuffs[currKey as keyof typeof NPStarBuffs] + "").replace(/(<.*>)|[^0-9.%]/g, "")
                ? `**${currKey}:** ${NPStarBuffs[currKey as keyof typeof NPStarBuffs]}\n`
                : ""),
        ""
    );

    const verboseRefundStarFields = [];

    for (const [key, value] of Object.entries({ ...NPStarVals })) {
        verboseRefundStarFields.push({ name: key, value: value + "", inline: true });
    }

    const minNPPerHit = vals.minNPFields.npPerHit,
        maxNPPerHit = vals.maxNPFields.npPerHit,
        minStarDropChancePerHit = vals.minStarFields.dropChancePerHit,
        maxStarDropChancePerHit = vals.maxStarFields.dropChancePerHit,
        minDamagePerHit = vals.minNPFields.damagePerHit,
        maxDamagePerHit = vals.maxNPFields.damagePerHit,
        minRemHPPerHit = vals.minNPFields.remHPPerHit,
        maxRemHPPerHit = vals.maxNPFields.remHPPerHit,
        hits = vals.calcTerms.hits.length,
        minNPRegen = vals.minNPFields.NPRegen,
        maxNPRegen = vals.maxNPFields.NPRegen,
        minMinStars = vals.minStarFields.minStars,
        minMaxStars = vals.minStarFields.maxStars,
        maxMinStars = vals.maxStarFields.minStars,
        maxMaxStars = vals.maxStarFields.maxStars,
        overkillNo = vals.minNPFields.overkillNo,
        maxOverkillNo = vals.maxNPFields.overkillNo;

    let minNPDesc = "__Minroll Breakdown__\n```\n|Hit | Damage |Enemy HP| Refund | Stars |\n";

    for (let hitNo = 0; hitNo < hits; hitNo++) {
        minNPDesc +=
            "| " +
            (hitNo + 1 + "   ").substring(0, 3) +
            "| " +
            (minDamagePerHit[hitNo] + " ".repeat(7)).substring(0, 7) +
            "|" +
            (Math.floor(minRemHPPerHit[hitNo]) + " ".repeat(8)).substring(0, 8) +
            "| " +
            (minNPPerHit[hitNo].toFixed(2) + "%" + " ".repeat(7)).substring(0, 7) +
            "| " +
            (minStarDropChancePerHit[hitNo] + " ".repeat(6)).substring(0, 6) +
            "|\n";
    }

    minNPDesc += "```";

    let maxNPDesc = "__Maxroll Breakdown__\n```\n|Hit | Damage |Enemy HP| Refund | Stars |\n";

    for (let hitNo = 0; hitNo < hits; hitNo++) {
        maxNPDesc +=
            "| " +
            (hitNo + 1 + "   ").substring(0, 3) +
            "| " +
            (maxDamagePerHit[hitNo] + " ".repeat(7)).substring(0, 7) +
            "|" +
            (Math.floor(maxRemHPPerHit[hitNo]) + " ".repeat(8)).substring(0, 8) +
            "| " +
            (maxNPPerHit[hitNo].toFixed(2) + "%" + " ".repeat(7)).substring(0, 7) +
            "| " +
            (maxStarDropChancePerHit[hitNo].toFixed(4) + " ".repeat(6)).substring(0, 6) +
            "|\n";
    }

    maxNPDesc += "```";

    let useDescription = false;

    if (minNPDesc.length + maxNPDesc.length > 1023) {
        minNPDesc = "**Minroll Breakdown:**\n```";
        maxNPDesc = "**Maxroll Breakdown:**\n```";
        useDescription = true;

        for (let hitNo = 0; hitNo < hits; hitNo++) {
            minNPDesc +=
                hitNo +
                1 +
                ": ⚔️ " +
                minDamagePerHit[hitNo] +
                " (" +
                Math.floor(minRemHPPerHit[hitNo]) +
                ") 🔋 " +
                minNPPerHit[hitNo].toFixed(2) +
                "%" +
                " ⭐ " +
                minStarDropChancePerHit[hitNo].toFixed(4) +
                "\n";

            maxNPDesc +=
                hitNo +
                1 +
                ": ⚔️ " +
                maxDamagePerHit[hitNo] +
                " (" +
                Math.floor(maxRemHPPerHit[hitNo]) +
                ") 🔋 " +
                maxNPPerHit[hitNo].toFixed(2) +
                "%" +
                " ⭐ " +
                maxStarDropChancePerHit[hitNo].toFixed(4) +
                "\n";
        }

        minNPDesc += "```";
        maxNPDesc += "```";
    }

    const fields = [
        ...(!useDescription ? [{ name: "Hit-wise Breakdown", value: minNPDesc + "\n" + maxNPDesc, inline: false }] : []),
        {
            name: "Total Refund",
            value: `${emoji("npbattery")} **${minNPRegen.toFixed(2)}%** (${overkillNo} overkill hits) *~* **${maxNPRegen.toFixed(
                2
            )}%** (${maxOverkillNo} overkill hits)`,
            inline: false,
        },
        {
            name: "Total Stars",
            value: `${emoji("instinct")} [**${minMinStars}** - **${minMaxStars}**] *~* [**${maxMinStars}** - **${maxMaxStars}**]`,
            inline: false,
        },
    ];

    const embedFields = [...(vals.calcTerms.verbosity === "nv" ? [] : verboseRefundStarFields), ...fields];

    return {
        title: "Refund & Stars",
        fields: embedFields as EmbedField[],
        name: "refundStars",
        useDescription,
        ...(useDescription ? { description: `${minNPDesc}\n${maxNPDesc}` } : {}),
        __description:
            __description +
            `Refund: ${emoji("npbattery")} **${minNPRegen.toFixed(2)}%** *~* **${maxNPRegen.toFixed(2)}%**\nStars: ${emoji(
                "instinct"
            )} [**${minMinStars}** - **${minMaxStars}**] *~* [**${maxMinStars}** - **${maxMaxStars}**]\nOKH: ${overkillNo}-${maxOverkillNo}`,
        __description2:
            description2 +
            `Refund: ${emoji("npbattery")} **${minNPRegen.toFixed(2)}%** *~* **${maxNPRegen.toFixed(2)}%**\nStars: ${emoji(
                "instinct"
            )} [**${minMinStars}** - **${minMaxStars}**] *~* [**${maxMinStars}** - **${maxMaxStars}**]\nOKH: ${overkillNo}-${maxOverkillNo}`,
        footer: { text: vals.calcTerms.isEnemy ? `${vals.calcTerms.servantName} (Enemy)` : `${vals.calcTerms.servantName} (Player)` },
    };
};

const getChainEmbeds = (vals: ChainCalcVals) => {
    let description = "";
    const cardEmbeds: {
        title: string;
        fields: EmbedField[];
        description: string;
        content: string;
        __description?: string;
        footer: { text: string };
    }[] = [];
    let hasRefundOrStars = false;

    vals.calcVals.forEach((calcVals, cardNo) => {
        const { minrollCalcVals, maxrollCalcVals, cardMinCmdString } = calcVals;

        let cardFields: EmbedField[] = [
            {
                name: "Total Damage",
                value: `${emoji("hits")} **${minrollCalcVals.damageFields.damage.toLocaleString(
                    "en-US"
                )}** [${minrollCalcVals.damageFields.minrollDamage.toLocaleString(
                    "en-US"
                )} *~* ${maxrollCalcVals.damageFields.maxrollDamage.toLocaleString("en-US")}]`,
                inline: false,
            },
        ];

        description += `**${cardNo + 1}⟩** \u200B \u200B \u200B ${emoji(
            minrollCalcVals.calcTerms.faceCard ? minrollCalcVals.calcTerms.cardName.toLowerCase() : "nplewd"
        )} **${minrollCalcVals.damageFields.damage.toLocaleString("en-US")}** (${minrollCalcVals.damageFields.minrollDamage.toLocaleString(
            "en-US"
        )} ~ ${maxrollCalcVals.damageFields.maxrollDamage.toLocaleString("en-US")})\n`;

        const embeds = getCardEmbeds({
            ...minrollCalcVals,
            calcTerms: { ...minrollCalcVals.calcTerms, verbosity: "vvv" },
        }).embeds.filter((embed) => "fields" in embed); // Embeds with fields only, i.e. verboseDamage and refundStars embeds
        if (embeds.length > 1) {
            // If refund/stars embed is present then there will be 2 embeds with fields, otherwise there will be only 1 (verboseDamage embed only)
            hasRefundOrStars = true;
        }

        const baseStats: { [key: string]: string | number } = {
            Level: minrollCalcVals.calcTerms.level,
            ...(minrollCalcVals.calcTerms.faceCard
                ? {}
                : { "NP Level": emoji(minrollCalcVals.calcTerms.strengthen ? "nplewd" : "nolewd") + minrollCalcVals.calcTerms.npLevel }),
            "Base ATK":
                minrollCalcVals.calcTerms.servantAtk -
                minrollCalcVals.calcTerms.fou -
                minrollCalcVals.calcTerms.fouPaw -
                minrollCalcVals.calcTerms.ce,
            "Fou & Fou Paw": minrollCalcVals.calcTerms.fou + minrollCalcVals.calcTerms.fouPaw,
            "CE ATK": minrollCalcVals.calcTerms.ce,
        };

        const baseVals: { [key: string]: string | number } = {
            "Class Attack Rate": minrollCalcVals.calcTerms.classAtkBonus,
            "Triangle Modifier":
                minrollCalcVals.calcTerms.triangleModifier +
                ` (${emoji(minrollCalcVals.generalFields.servantClass.toLowerCase())} → ${emoji(
                    minrollCalcVals.calcTerms.enemyClass.toLowerCase()
                )})`,
            "Attribute Modifier": minrollCalcVals.calcTerms.attributeModifier,
            ...(hasRefundOrStars
                ? {
                      "Star Gen":
                          emoji(minrollCalcVals.calcTerms.cardName) + " " + (minrollCalcVals.calcTerms.baseStarRate * 100).toFixed(2) + "%",
                      "Offensive NP Rate":
                          emoji(minrollCalcVals.calcTerms.cardName) + " " + minrollCalcVals.calcTerms.offensiveNPRate / 100 + "%",
                  }
                : {}),
        };

        const baseDescription =
            Object.keys(baseStats)
                .reduce((acc, curr) => (acc += `**${curr}:** ${baseStats[curr]} | `), "")
                .slice(0, -2) +
            "\n" +
            Object.keys(baseVals).reduce((acc, curr) => (acc += `**${curr}:** ${baseVals[curr]}\n`), "");

        const cardAttributes: { [key: string]: string | number } = {
            "Card Damage Value": minrollCalcVals.calcTerms.faceCard
                ? emoji(minrollCalcVals.calcTerms.cardName) + " " + minrollCalcVals.calcTerms.cardDamageValue * 100 + "%"
                : emoji("nplewd") + " " + minrollCalcVals.calcTerms.npDamageMultiplier * 100 + "%",
            "Card Refund Value": minrollCalcVals.calcTerms.cardNPValue * 100 + "%",
            "Card Star Value": minrollCalcVals.calcTerms.cardStarValue * 100 + "%",
            "First Card Bonus":
                minrollCalcVals.calcTerms.artsFirst || minrollCalcVals.calcTerms.busterFirst || minrollCalcVals.calcTerms.quickFirst
                    ? (minrollCalcVals.calcTerms.artsFirst ? emoji("artsfirst") + " " : "") +
                      (minrollCalcVals.calcTerms.busterFirst ? emoji("busterfirst") + " " : "") +
                      (minrollCalcVals.calcTerms.quickFirst ? emoji("quickfirst") + " " : "")
                    : "None",
        };

        const cardDescription = Object.keys(cardAttributes).reduce((acc, curr) => (acc += `**${curr}:** ${cardAttributes[curr]}\n`), "");

        const buffs: { [key: string]: string | number | boolean } = {
            [`${emoji("atk_up")} ATK Mod`]: minrollCalcVals.calcTerms.atkMod * 100 + "%",
            [`${emoji("def_up")} DEF Mod`]: minrollCalcVals.calcTerms.defMod * 100 + "%",
            [`${emoji(`${minrollCalcVals.calcTerms.cardName.toLowerCase()}_up`)} Card Mod`]: minrollCalcVals.calcTerms.cardMod * 100 + "%",
            ...(minrollCalcVals.calcTerms.faceCard
                ? {}
                : { [`${emoji("np_dmg_up")} NP Damage Mod`]: minrollCalcVals.calcTerms.npDamageMod * 100 + "%" }),
            [`${emoji("sp_atk_up")} Power Mod`]: minrollCalcVals.calcTerms.powerMod * 100 + "%",
            [`${emoji("crit_dmg_up")} Critical`]: minrollCalcVals.calcTerms.isCritical,

            [`${emoji("crit_dmg_up")} Crit Damage Mod`]: minrollCalcVals.calcTerms.critDamageMod * 100 + "%",
            ...(minrollCalcVals.calcTerms.faceCard
                ? {}
                : { [`${emoji("sp_atk_up")} Supereffective Mod`]: minrollCalcVals.calcTerms.superEffectiveModifier * 100 + 100 + "%" }),
            [`${emoji("spec_def_up")} Special Defense Mod`]: minrollCalcVals.calcTerms.specialDefMod * 100 + "%",
            [`${emoji("specdmg")} Special Defense Mod`]: minrollCalcVals.calcTerms.damageSpecialMod * 100 + "%",
            [`${emoji("sp_atk_up")} Flat Damage`]: minrollCalcVals.calcTerms.dmgPlusAdd,
            ...(hasRefundOrStars
                ? {
                      [`${emoji("np_gain_up")} NP Gain Mod`]: minrollCalcVals.calcTerms.npChargeRateMod,
                      [`${emoji("star_gen_up")} Star Drop Mod`]: minrollCalcVals.calcTerms.starDropMod,
                      [`${emoji("np_gain_up")} Enemy Server Mod`]: minrollCalcVals.calcTerms.enemyServerMod,
                      [`${emoji("star_gen_up")} Enemy Server Rate`]: minrollCalcVals.calcTerms.serverRate,
                  }
                : {}),
        };

        const buffDescription = Object.keys(buffs).reduce((acc, curr) => (acc += `**${curr}:** ${buffs[curr]}\n`), "");

        if (hasRefundOrStars) {
            // If refundStars is present, it will be embeds[0]

            cardFields = cardFields.concat([
                {
                    name: "Total Refund",
                    value: `${emoji("npbattery")} **${minrollCalcVals.minNPFields.NPRegen.toFixed(2)}%** (${
                        minrollCalcVals.minNPFields.overkillNo
                    } OKH) *~* **${maxrollCalcVals.maxNPFields.NPRegen.toFixed(2)}%** (${maxrollCalcVals.maxNPFields.overkillNo} OKH)`,
                    inline: false,
                },
                {
                    name: "Total Stars",
                    value: `${emoji("instinct")} [**${minrollCalcVals.minStarFields.minStars}** - **${
                        minrollCalcVals.minStarFields.maxStars
                    }**] *~* [**${maxrollCalcVals.maxStarFields.minStars}** - **${maxrollCalcVals.maxStarFields.maxStars}**]`,
                    inline: false,
                },
            ]);
        }

        let verboseDescription = `**Base Stats -**\n${baseDescription}\n${emoji(
            minrollCalcVals.calcTerms.faceCard ? minrollCalcVals.calcTerms.cardName.toLowerCase() : "nplewd"
        )} **Card Values -**\n${cardDescription}\n**Buffs -**\n${buffDescription}\n`;

        if (hasRefundOrStars) {
            verboseDescription += "**Hit-wise Breakdown -**\n";

            if ("useDescription" in embeds[0] && embeds[0].useDescription === true) {
                verboseDescription += embeds[0].description;
            } else {
                verboseDescription += embeds[0].fields?.find((field) => field.name === "Hit-wise Breakdown")?.value ?? "";
            }
        }

        cardEmbeds.push({
            title: `${emoji(minrollCalcVals.calcTerms.faceCard ? minrollCalcVals.calcTerms.cardName.toLowerCase() : "nplewd")} Card ${
                cardNo + 1
            } Detailed Info`,
            fields: cardFields,
            description: verboseDescription,
            content:
                "**Calc String:\n**```" +
                cardMinCmdString
                    .replace(/\s+/g, " ")
                    .split(/\s/) // Replace multiple whitespace with single space char and remove repeated args from the string
                    .filter((word, index, words) => index === words.indexOf(word))
                    .join(" ") +
                "```",
            footer: {
                text: minrollCalcVals.generalFields.isEnemy
                    ? `${minrollCalcVals.generalFields.servantName} (Enemy)`
                    : `${minrollCalcVals.generalFields.servantName} (Player)`,
            },
        });
    });

    const totalFields = [
        {
            name: "Total Damage",
            value: `${emoji("hits")} **${vals.totalDamage.toLocaleString("en-US")}** (${vals.minrollTotalDamage.toLocaleString(
                "en-US"
            )} ~ ${vals.maxrollTotalDamage.toLocaleString("en-US")})`,
            inline: false,
        },
        ...(hasRefundOrStars
            ? [
                  {
                      name: "Total Refund",
                      value: `${emoji("npbattery")} **${vals.minrollTotalRefund.toFixed(2)}%** (${
                          vals.overkillNo
                      } OKH) *~* **${vals.maxrollTotalRefund.toFixed(2)}%** (${vals.maxOverkillNo} OKH)`,
                      inline: false,
                  },
                  {
                      name: "Total Stars",
                      value: `${emoji("instinct")} [**${vals.minrollTotalMinStars}** - **${vals.minrollTotalMaxStars}**] *~* [**${
                          vals.maxrollTotalMinStars
                      }** - **${vals.maxrollTotalMaxStars}**]`,
                      inline: false,
                  },
              ]
            : []),
    ];

    const __description =
        description + totalFields.reduce((descStr, currField) => descStr + `**${currField.name}**: ${currField.value}\n`, "\n");

    return {
        embeds: [
            {
                title: `Damage for ${emoji(vals.calcVals[0].minrollCalcVals.generalFields.servantClass.toLowerCase())} ${
                    vals.calcVals[0].minrollCalcVals.generalFields.servantName
                }`,
                url: `${vals.calcVals[0].minrollCalcVals.generalFields.servantURL}`,
                thumbnail: { url: `${vals.calcVals[0].minrollCalcVals.generalFields.servantThumbnail}` },
                description,
                fields: totalFields,
                __description,
                footer: {
                    text: vals.calcVals[0].minrollCalcVals.generalFields.isEnemy
                        ? `${vals.calcVals[0].minrollCalcVals.generalFields.servantName} (Enemy)`
                        : `${vals.calcVals[0].minrollCalcVals.generalFields.servantName} (Player)`,
                },
            },
            ...cardEmbeds,
        ],
        type: "chain",
    };
};

const getEnemyEmbeds = (vals: EnemyCalcVals) => {
    const waveEmbeds = [];
    const waveTotalFields = [];
    const allEnemyFields = [];

    const calcTerms =
        (vals.waves[0].enemyVals[0].calcVals as ChainCalcVals).calcVals?.[0].minrollCalcVals?.calcTerms ??
        (vals.waves[0].enemyVals[0].calcVals as CalcVals).calcTerms;

    const { servantClass, servantName, servantThumbnail, servantURL } = calcTerms;
    const showEnemyFields = vals.verboseLevel > 0;
    let isEnemy = false;

    for (const [waveNo, wave] of vals.waves.entries()) {
        const {
            totalDamage,
            minrollTotalDamage,
            maxrollTotalDamage,
            minrollTotalRefund,
            maxrollTotalRefund,
            minrollTotalStars,
            maxrollTotalStars,
            overkillNo,
            maxOverkillNo,
        } = wave.waveFields;

        let waveHasRefundOrStars = false;

        const enemyFields = [];
        const detailedEnemyFields = [];

        for (const [enemyNo, enemy] of wave.enemyVals.entries()) {
            const { damage, minDamage, maxDamage, enemyAttribute, enemyClass } = enemy;

            const hasRefundOrStars = (val: {
                calcVals: CalcVals | ChainCalcVals;
                damage: number;
                minDamage: number;
                maxDamage: number;
                hasRefundOrStars: boolean;
                minNPRegen?: number;
                maxNPRegen?: number;
                minStars?: number;
                maxStars?: number;
                overkillNo?: number;
                maxOverkillNo?: number;
                enemyClass: string;
                enemyAttribute: string;
                warnings: string;
                hasChain: boolean;
            }): val is Required<typeof enemy> => {
                return (waveHasRefundOrStars = val.hasRefundOrStars);
            };

            const enemyDamage = `Damage: **${damage.toLocaleString("en-US")}** (${minDamage.toLocaleString(
                "en-US"
            )} *~* ${maxDamage.toLocaleString("en-US")})`;
            let enemyDesc = enemyDamage;

            if (hasRefundOrStars(enemy)) {
                const { minNPRegen, maxNPRegen, minStars, maxStars, overkillNo, maxOverkillNo } = enemy;

                enemyDesc += `\nRefund: **${minNPRegen.toFixed(2)}%** *~* **${maxNPRegen.toFixed(
                    2
                )}%**\nStars: **${minStars}** ~ **${maxStars}**\n[**${overkillNo}** *~* **${maxOverkillNo}** OKH]`;
            }

            enemyFields.push({
                name: `${emoji(enemyClass.toLowerCase())} Enemy ${enemyNo + 1} (${enemyAttribute})`,
                value: enemyDesc,
                inline: true,
            });

            let detailedDescription = "";

            if (enemy.hasChain) {
                const chainEmbeds = getChainEmbeds(enemy.calcVals as ChainCalcVals).embeds;

                detailedDescription = chainEmbeds[0]?.__description ?? "";

                isEnemy = (enemy.calcVals as ChainCalcVals).calcVals[0].minrollCalcVals.generalFields.isEnemy;
            } else {
                const cardEmbeds = getCardEmbeds(enemy.calcVals as CalcVals).embeds;

                detailedDescription =
                    vals.verboseLevel > 1 ? (cardEmbeds.find((embed) => embed.name === "verboseDamage")?.__description ?? "") + "\n" : "";

                detailedDescription +=
                    (cardEmbeds.find((embed) => embed.name === "verboseDamage")?.__description2 ?? "") +
                    "" +
                    "\n" +
                    enemyDamage +
                    "\n" +
                    (cardEmbeds.find((embed) => embed.name === "refundStars")?.[
                        vals.verboseLevel > 1 ? "__description2" : "__description"
                    ] ?? "");

                isEnemy = (enemy.calcVals as CalcVals).generalFields.isEnemy;
            }

            detailedDescription = detailedDescription
                .replace(/\s+/g, (substring) => substring.split("")[0])
                // Replace multiple whitespace with single whitespace of the same type
                .trim();

            detailedEnemyFields.push({
                name: `${emoji(enemyClass.toLowerCase())} Enemy ${enemyNo + 1} (${enemyAttribute})`,
                value: detailedDescription + "\u200B", // To avoid Discord error if detailedDescription is empty
                inline: true,
            });
        }

        const totalField = {
            name: "Total",
            value: `__**Wave ${waveNo + 1}**__:\n${emoji("hits")} **${totalDamage.toLocaleString(
                "en-US"
            )}** (${minrollTotalDamage.toLocaleString("en-US")} *~* ${maxrollTotalDamage.toLocaleString("en-US")})`,
        };

        if (waveHasRefundOrStars) {
            totalField.value += `\n${emoji("npbattery")} **${minrollTotalRefund.toFixed(2)}%** *~* **${maxrollTotalRefund.toFixed(2)}%**`;
            totalField.value += `\n${emoji(
                "instinct"
            )} **${minrollTotalStars}** *~* **${maxrollTotalStars}** (${overkillNo} - ${maxOverkillNo} OKH)`;
        }

        allEnemyFields.push(...enemyFields);

        waveTotalFields.push(totalField);

        waveEmbeds.push({
            title: `Wave ${waveNo + 1} damage for ${emoji(servantClass.toLowerCase())} ${servantName}`,
            fields: detailedEnemyFields,
            thumbnail: { url: servantThumbnail },
            url: servantURL,
            waveNo: waveNo + 1,
            footer: {
                text: `${servantName} (${isEnemy ? "Enemy" : "Player"})`,
            },
        });
    }

    return {
        embeds: [
            {
                title: `Damage for ${emoji(servantClass.toLowerCase())} ${servantName}`,
                fields: [...(showEnemyFields ? allEnemyFields : []), ...waveTotalFields],
                thumbnail: { url: servantThumbnail },
                url: servantURL,
                waveNo: 0,
                footer: {
                    text: `${servantName} (${isEnemy ? "Enemy" : "Player"})`,
                },
            },
            ...waveEmbeds,
        ],
        type: "enemy",
    };
};

export { getCardEmbeds, getChainEmbeds, getEnemyEmbeds };
