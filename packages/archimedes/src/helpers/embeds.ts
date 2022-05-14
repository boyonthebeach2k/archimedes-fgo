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
    const BaseVals = {
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
        "Card Mod": emoji("avatar") + vals.calcTerms.cardMod * 100 + "%",
        "ATK Mod": emoji("charisma") + " " + vals.calcTerms.atkMod * 100 + "%",
        "DEF Mod": emoji("defup") + " " + vals.calcTerms.defMod * 100 + "%",
        "NP Mod": emoji("npmod") + " " + vals.calcTerms.npDamageMod * 100 + "%",
        "Supereffective Mod": emoji("semod") + " " + (1 + vals.calcTerms.superEffectiveModifier) + "x",
        "Power Mod": emoji("pmod") + " " + vals.calcTerms.powerMod * 100 + "%",
        "Crit Damage Mod": emoji("crit") + " " + vals.calcTerms.critDamageMod * 100 + "%",
        "Flat Damage": emoji("divinity") + " " + vals.calcTerms.dmgPlusAdd,
    };

    const verboseFields = [];

    for (const [key, value] of Object.entries({ ...BaseVals })) {
        verboseFields.push({ name: key, value: value + "", inline: true });
    }

    if (vals.generalFields.warnMessage.trim().length) {
        verboseFields.push({ name: "Warnings", value: `⚠️ ${vals.generalFields.warnMessage}`, inline: false });
    }

    const embeds = [
        {
            title: `DMG for ${emoji(vals.generalFields.servantClass)} ${vals.generalFields.servantName}`,
            url: vals.generalFields.servantURL,
            thumbnail: { url: vals.generalFields.servantThumbnail },
            description:
                `${emoji("hits")} **${vals.damageFields.damage.toLocaleString("en-US")}** (${vals.damageFields.minrollDamage.toLocaleString(
                    "en-US"
                )} ~ ${vals.damageFields.maxrollDamage.toLocaleString("en-US")})` +
                (vals.generalFields.warnMessage.trim().length ? `\n\n⚠️ ${vals.generalFields.warnMessage}` : ""),
            name: "damage",
        },
        {
            title: `DMG for ${emoji(vals.generalFields.servantClass)} ${vals.generalFields.servantName} using`,
            url: vals.generalFields.servantURL,
            thumbnail: { url: vals.generalFields.servantThumbnail },
            fields: verboseFields as EmbedField[],
            description: `${emoji("hits")} **${vals.damageFields.damage.toLocaleString(
                "en-US"
            )}** (${vals.damageFields.minrollDamage.toLocaleString("en-US")} ~ ${vals.damageFields.maxrollDamage.toLocaleString("en-US")})`,
            name: "verboseDamage",
        },
    ];

    if (vals.calcTerms.verbosity.length > 0 && vals.calcTerms.verbosity !== "nv") {
        return [embeds[1], embeds[0]];
    }

    return embeds;
};

const getCardNPStarEmbed = (vals: CalcVals) => {
    const NPStarVals = {
        "Base NP Gain": emoji("npgen") + " " + (vals.calcTerms.offensiveNPRate / 100).toFixed(2) + "%",
        "Base Star Gen": emoji("instinct") + " " + (vals.calcTerms.baseStarRate * 10).toFixed(2) + "%",
        "Arts First": emoji("artsfirst") + " " + vals.calcTerms.artsFirst,
        "Quick First": emoji("quickfirst") + " " + vals.calcTerms.quickFirst,
        Critical: emoji("crit") + " " + vals.calcTerms.isCritical,
        "Card Mod": emoji("avatar") + " " + vals.calcTerms.cardMod,
        "Enemy Server Mod": emoji(vals.calcTerms.enemyClass) + " " + vals.calcTerms.enemyServerMod,
        "Enemy Server Rate": emoji(vals.calcTerms.enemyClass) + " " + vals.calcTerms.serverRate,
        "NP Gain Mod": emoji("npgen") + " " + vals.calcTerms.npChargeRateMod,
        "Card Refund Value": emoji("npbattery") + " " + vals.calcTerms.cardNPValue,
        "Star Drop Mod": emoji("stargen") + " " + vals.calcTerms.starDropMod,
        "Card Star Value": emoji("starrateup") + " " + vals.calcTerms.cardStarValue.toFixed(2),
        "Card Damage Value": `${emoji(!vals.calcTerms.faceCard ? "nplewd" : vals.calcTerms.cardName ?? "")} ${
            vals.calcTerms.faceCard ? " " + vals.calcTerms.cardDamageValue + "x" : " " + vals.calcTerms.npDamageMultiplier * 100 + "%"
        }`,
        "Damage range": `${emoji("hits")} [\`${vals.damageFields.minrollDamage.toLocaleString(
            "en-US"
        )}\`, \`${vals.damageFields.maxrollDamage.toLocaleString("en-US")}\`]`,
    };

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
            (Math.floor(minStarDropChancePerHit[hitNo]) + "-" + Math.ceil(minStarDropChancePerHit[hitNo]) + " ".repeat(6)).substring(0, 6) +
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
            (Math.floor(maxStarDropChancePerHit[hitNo]) + "-" + Math.ceil(maxStarDropChancePerHit[hitNo]) + " ".repeat(6)).substring(0, 6) +
            "|\n";
    }

    maxNPDesc += "```";

    const fields = [
        { name: "Hit-wise Breakdown", value: minNPDesc + "\n" + maxNPDesc, inline: false },
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
    };
};

const getChainEmbeds = (vals: ChainCalcVals) => {
    let description = "";
    let cardEmbeds: any = [];
    let hasRefundOrStars = false;

    vals.calcVals.forEach((calcVals, cardNo) => {
        const { minrollCalcVals, maxrollCalcVals } = calcVals;

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
                ` (${emoji(minrollCalcVals.generalFields.servantClass)} → ${emoji(minrollCalcVals.calcTerms.enemyClass)})`,
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

        const verboseDescription =
            `**Base Stats -**\n${baseDescription}\n${emoji(
                minrollCalcVals.calcTerms.faceCard ? minrollCalcVals.calcTerms.cardName.toLowerCase() : "nplewd"
            )} **Card Values -**\n${cardDescription}\n**Buffs -**\n${buffDescription}\n` +
            (hasRefundOrStars
                ? `**Hit-wise Breakdown -**\n${
                      embeds[0] /* refundStars embed */
                          .fields!.find((field) => field.name === "Hit-wise Breakdown")!.value
                  }`
                : "");

        cardEmbeds.push({
            title: `${emoji(minrollCalcVals.calcTerms.faceCard ? minrollCalcVals.calcTerms.cardName.toLowerCase() : "nplewd")} Card ${
                cardNo + 1
            } Detailed Info`,
            fields: cardFields,
            description: verboseDescription,
            content:
                "**Calc String:\n**```" +
                minrollCalcVals.calcTerms.calcString
                    .replace(/\s+/g, " ")
                    .split(/\s/) // Replace multiple whitespacd with single space char and remove repeated args from the string
                    .filter((word, index, words) => index === words.indexOf(word))
                    .join(" ") +
                "```",
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

    return {
        embeds: [
            {
                title: `Damage for ${emoji(vals.calcVals[0].minrollCalcVals.generalFields.servantClass)} ${
                    vals.calcVals[0].minrollCalcVals.generalFields.servantName
                }`,
                url: `${vals.calcVals[0].minrollCalcVals.generalFields.servantURL}`,
                thumbnail: { url: `${vals.calcVals[0].minrollCalcVals.generalFields.servantThumbnail}` },
                description,
                fields: totalFields,
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

        for (const [enemyNo, enemy] of wave.enemyVals.entries()) {
            const { damage, minDamage, maxDamage, enemyAttribute, enemyClass } = enemy;

            const hasRefundOrStars = (val: any): val is Required<typeof enemy> => {
                return (waveHasRefundOrStars = val.hasRefundOrStars);
            };

            let enemyDesc = `Damage: **${damage.toLocaleString("en-US")}** (${minDamage.toLocaleString(
                "en-US"
            )} *~* ${maxDamage.toLocaleString("en-US")})`;

            if (hasRefundOrStars(enemy)) {
                const { minNPRegen, maxNPRegen, minStars, maxStars, overkillNo, maxOverkillNo } = enemy;

                enemyDesc += `\nRefund: **${minNPRegen.toFixed(2)}%** *~* **${maxNPRegen.toFixed(
                    2
                )}%**\nStars: **${minStars}** ~ **${maxStars}**\n[**${overkillNo}** *~* **${maxOverkillNo}** OKH]`;
            }

            enemyFields.push({
                name: `${emoji(enemyClass)} Enemy ${enemyNo + 1} (${enemyAttribute})`,
                value: enemyDesc,
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
            title: `Wave ${waveNo + 1} damage for ${emoji(servantClass)} ${servantName}`,
            fields: enemyFields,
            thumbnail: { url: servantThumbnail },
            url: servantURL,
        });
    }

    return {
        embeds: [
            {
                title: `Damage for ${emoji(servantClass)} ${servantName}`,
                fields: [...(showEnemyFields ? allEnemyFields : []), ...waveTotalFields],
                thumbnail: { url: servantThumbnail },
                url: servantURL,
            },
            ...waveEmbeds,
        ],
        type: "enemy",
    };
};

export { getCardEmbeds, getChainEmbeds, getEnemyEmbeds };
