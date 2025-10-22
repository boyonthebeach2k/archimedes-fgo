import { ClassName, Enemy, Func, NoblePhantasm, Servant } from "@atlasacademy/api-connector";
import { Attribute } from "@atlasacademy/api-connector/dist/Schema/Attribute";
import { EntityType } from "@atlasacademy/api-connector/dist/Schema/Entity";
import { NoblePhantasmGain } from "@atlasacademy/api-connector/dist/Schema/NoblePhantasm";

import { attributeRelation, classList, classRelation } from "../assets/assets";
import { getPassivesFromServant } from "../helpers/get-passives";
import { parseBaseCommandString } from "../helpers/parse-args";
import { CommandObject } from "./interfaces/command-object.interfaces";
import { CalcTerms, CalcVals, CustomFields, DamageFields, NPFields, StarFields } from "./interfaces/commands.interfaces";

const f32 = (val: number) => Math.fround(val);

/** NA NPs for the given svt, i.e. before any JP ludes */
let NANoblePhantasms: NoblePhantasm.NoblePhantasm[] = [];

/** Checks if a given entity is an enemy:
 * Enemies have `type: "enemy"` by definition, so to check if the given entity is an enemy, simply check that the type is "enemy"
 * @param entity Entity of type {@link Enemy.Enemy} | `{ detail: string }`, to be checked
 * @returns boolean: true if `entity.type === "enemy"`, false otherwise
 */
const isEnemy = (entity: Servant.Servant | Enemy.Enemy): entity is Enemy.Enemy => entity.cardDetails.weak !== undefined;

/**
 * Redistributes hit percentages for a card over the given overriding number of hits. This is done by multiplying or dividing each
 * percentage by the factor of increase/decrease into a new array whose length corresponds to the specified hitCountOverride
 * @param hits The existing hit percentages to redistribute
 * @param hitCountOverride The multiplier/submultiplier to redistribute by
 * @returns number[]: The updated hit distribution for the card
 */
const overrideHitCounts = (hits: number[], hitCountOverride: number) => {
    const newHits: number[] = [];

    if (hitCountOverride < hits.length) {
        for (let i = 0; i < hits.length; i++) {
            newHits[Math.floor(i / (hits.length / hitCountOverride))] = newHits[Math.floor(i / (hits.length / hitCountOverride))] || 0;
            newHits[Math.floor(i / (hits.length / hitCountOverride))] += newHits[i];
        }
    } else {
        for (let i = 0; i < hits.length; i++) {
            for (let j = i; j < i + hitCountOverride / hits.length; j++) {
                newHits[i + j] = newHits[i + j] || 0;
                newHits[i + j] += Math.floor(hits[i] / (hitCountOverride / hits.length));
            }
        }
    }

    return newHits;
};

/**
 * Maps the given CommandObject to promise that resolves to terms that are then passed into the
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage},
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas
 * @param svt The servant or enemy to calulate damage for
 * @param args The {@link CommandObject} obtained after parsing the input command string
 * @param servantName Fallback for the name of the servant or enemy to calulate damage for
 * @param npName Fallback for the name of the noble phantasm (if any) to calulate damage for
 * @returns Object describing the various terms in the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula
 * (as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas, if applicable)
 * for the given args object (reading the linked docs is recommended to follow this function properly)
 */
const commandObjectToCalcTerms = (
    svt: Servant.Servant | Enemy.Enemy,
    args: Partial<CommandObject>,
    servantName?: string,
    npName?: string
): CalcTerms => {
    let warnMessage = args.unknownArgs?.length ? `Unknown args: ${(args.unknownArgs ?? []).join(", ")}\n` : "";

    //--- Base setup
    if (args.npLevel !== undefined && (args.npLevel > 5 || args.npLevel < 1)) {
        warnMessage += "NP Level must be within [1,5]. Setting NP level to 5 (default).\n";
        args.npLevel = 5;
    }
    if (args.ocLevel !== undefined && (args.ocLevel > 5 || args.ocLevel < 1)) {
        warnMessage += "OC Level must be within [1,5]. Setting OC level to 1 (default).\n";
        args.ocLevel = 1;
    }
    if (args.npLevel === undefined) {
        args.npLevel = 5;
    }
    if (args.ocLevel === undefined) {
        args.ocLevel = 1;
    }

    args.npLevel = Math.floor(args.npLevel);
    if (args.fou && (args.fou < 0 || args.fou > 2000)) {
        warnMessage += "Fou value cannot be lesser than 0 or greater than 2000. Setting Fou value to 1000 (default).\n";
        args.fou = 1000;
    }
    if (args.fou === undefined) {
        args.fou = isEnemy(svt) ? 0 : 1000;
    }
    args.fou = Math.floor(args.fou);
    if (args.ce === undefined) {
        args.ce = 0;
    }
    args.ce = Math.floor(args.ce);
    if (args.level !== undefined && (args.level < 1 || args.level > 120)) {
        warnMessage += "Servant level must lie in [1, 120]. Setting to natural (ungrailed) level cap.\n";
        args.level = svt.lvMax;
    }
    if (args.level === undefined) {
        args.level = svt.lvMax;
    }
    args.level = Math.floor(args.level);

    if (args.super) {
        args.level = 100;
        args.fou = 2000;
    }
    if (args.hyper) {
        args.level = 120;
        args.fou = 2000;
    }

    //--- Setting facecard, if any
    const faceCard = !!(!isEnemy(svt) && (args.arts || args.buster || args.quick || args.extra));
    const enemyFaceCard = !!(isEnemy(svt) && (args.weak || args.strength));

    //--- Setting NP to use
    let nps = Object.keys(svt.noblePhantasms),
        npNumber: string;

    const naNPs = Object.keys(NANoblePhantasms);

    if (!isEnemy(svt)) {
        nps = Object.keys(svt.noblePhantasms ?? []);
    }

    servantName = servantName ?? svt.name;

    const defaultNP0 = [268, 312, 391, 405];
    // Astarte, Melusine, Summer Barghest, Iori
    if (defaultNP0.indexOf(svt.collectionNo) > -1) {
        npNumber = nps[0];
    } else {
        /* Setting last NA NP, i.e. after all NA ludes, as default */
        if (naNPs.length) {
            npNumber = naNPs.length ? naNPs[naNPs.length - 1] : "-1";
        } else {
            npNumber = nps.length ? nps[nps.length - 1] : "-1";
        }

        if (isEnemy(svt)) {
            npNumber = "0";
        }
    }

    if (args.str !== undefined) {
        if (args.str) npNumber = nps[nps.length - 1];
        else npNumber = nps[0];
    }
    if (args.setNp !== undefined) {
        if (Object.keys(nps).includes(args.setNp + "")) {
            npNumber = nps.length ? nps[args.setNp] : "-1";
        } else {
            warnMessage += `${args.setNp} is not in ${servantName}'s NPs. Try \`!l ${svt.collectionNo}\` first.\n`;
        }
    }

    /** The noble phantasm to use */
    const noblePhantasm = svt.noblePhantasms[+npNumber] ?? {};

    let npDamageMultiplier = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    npName = npName ?? NANoblePhantasms[+npNumber]?.name ?? noblePhantasm.name;

    const npFns = (noblePhantasm as NoblePhantasm.NoblePhantasm).functions ?? {};

    for (const [npFnNo, npFn] of npFns?.entries?.() ?? []) {
        if (npFn.funcType.includes(Func.FuncType.DAMAGE_NP)) {
            npDamageMultiplier = f32(npFn?.svals[args.npLevel - 1].Value ?? 0) / f32(10);

            // Break here ensures Arash's and Gong's second NP function (OC damage multiplier) is not counted
            break;
        }
        if (npFnNo === npFns.length - 1 && !(faceCard || enemyFaceCard)) {
            // If there is no damageNp; set -Infinity to swallow any flat damage
            args.flatDamage = -Infinity;
        }
    }

    let ocDamageMultiplier = 0,
        ocNpHitsPresent = false;

    if ([201300, 504400].includes(svt.id)) {
        // Empirically, the second np function contains the OC NP damage multiplier for Arash and Gong

        const svalsIndex = `svals${args.ocLevel === 1 ? "" : args.ocLevel}` as "svals" | "svals2" | "svals3" | "svals4" | "svals5";

        ocDamageMultiplier = f32(npFns[1][svalsIndex]?.[0].Value ?? 0) / f32(10);

        ocNpHitsPresent = true;
    }

    npDamageMultiplier = f32(args.npValue ?? npDamageMultiplier) / f32(100);
    ocDamageMultiplier = f32(args.ocValue ?? ocDamageMultiplier) / f32(100);

    //--- Enemy class and attribute
    let enemyClass = "shielder",
        enemyAttribute = svt.attribute;

    for (const className of Object.keys(classRelation)) {
        if (className === "beast") {
            // Do not set enemyClass to beast if args.beast is true as that switch is for the attribute
            continue;
        }

        if (args[className.toLowerCase() as keyof CommandObject]) {
            enemyClass = className;
        }
    }

    if (args.beastClass /* Set enemyClass to beast and set enemyAttribute to beast by default */) {
        enemyClass = ClassName.BEAST;
        enemyAttribute = Attribute.BEAST;
    }

    for (const attribute of Object.keys(attributeRelation)) {
        if (args[attribute.toLowerCase() as keyof CommandObject]) {
            enemyAttribute = attribute as typeof svt.attribute;
        }
    }

    //--- Other terms in the damage formula

    const classAtkBonus = f32((classList[svt.className] ?? 1000) / f32(1000));

    let servantAtk = f32(svt.atkGrowth[args.level - 1]);

    let triangleModifier = f32(args.classOverride ?? (classRelation[svt.className]?.[enemyClass] ?? 1000) / f32(1000));

    const attributeModifier = f32(args.attributeOverride ?? (attributeRelation[svt.attribute]?.[enemyAttribute] ?? 1000) / f32(1000));

    let extraCardModifier: 1 | 2 | 3.5 = args.extra ? 2 : 1;

    let cardMod = args.extra ? f32(0) : f32(args.cardMod ?? 0) / f32(100);

    let cardPower = args.extra ? f32(0) : f32(args.cardPower ?? 0) / f32(100);

    const isCritical = !!((faceCard && args.critical && !args.extra) || (enemyFaceCard && (args.strength || args.critical) && !args.weak));

    let critDamageMod = f32(args.critDamageMod ?? 0) / f32(100);

    let atkMod = f32(args.atkMod ?? 0) / f32(100);

    let defMod = f32(args.defMod ?? 0) / f32(100);

    const specialDefMod = f32(args.specialDefenseMod ?? 0) / f32(100);

    const damageSpecialMod = f32(args.specialAttackMod ?? 0) / f32(100);

    let npDamageMod = f32(args.npMod ?? 0) / f32(100);
    let npDamageDownMod = f32(args.npModDown ?? 0) / f32(100);

    const busterChainMod: 0 | 0.2 = args.busterChain && faceCard && args.buster ? 0.2 : 0;

    let firstCardBonus = 0;

    const superEffectiveModifier = f32((args.superEffectiveMod ?? 100) - 100) / f32(100);

    let powerMod = f32(args.powerMod ?? 0) / f32(100);

    const selfDamageMod = 0 as const;

    let dmgPlusAdd = f32(args.flatDamage ?? 0);

    const selfDmgCutAdd = 0 as const;

    if (svt.collectionNo === 1 /* Mash */) {
        servantAtk = f32(args.level ? svt.atkGrowth[args.level - 1] : svt.atkGrowth[79]);
    }
    if (enemyClass === "ruler" && svt.collectionNo === 167 /* Alter-ego Kiara ATK class advantage against rulers */) {
        triangleModifier = f32(args.classOverride ?? classRelation[svt.className]["assassin"] / f32(1000));
    }
    if (enemyClass === "saber" && svt.collectionNo === 418 /* Ciel's ATK class advantage against sabers */) {
        triangleModifier = f32(args.classOverride ?? classRelation[svt.className]["saber"] / f32(1000)) * 1.5;
    }
    if (
        enemyClass === "beastIV" &&
        svt.traits.some((trait) => trait.id === 2632) /* Treasured Beast DEF class disadvantage against Demonic Beast servants  */
    ) {
        triangleModifier = f32(2);
        warnMessage += "[Demonic Beast class advantage against Treasured Beast has been preset]\n";
    }
    if (!faceCard && svt.collectionNo === 351 /* Archetype: Earth */) {
        cardMod += f32(0.3);
        warnMessage += "[Millennium Castle passive has been activated]\n";
    }

    servantAtk = f32(args.totalAttack ?? servantAtk + args.fou + (args.ce ?? 0) + (faceCard && !args.extra ? args.fouPaw ?? 0 : 0));

    let cardDamageValue = 1;
    let cardDamageRate = 1000;
    let cardAttackNPRate = 1000;
    let cardDropStarRate = 1000;

    /** Card hit damage distribution */
    let hits = (noblePhantasm as NoblePhantasm.NoblePhantasm).npDistribution ?? [];

    // Lasagna changed it from enums for whatever reason to futureproof
    const cardMap: Record<string, string> = {
        "1": "arts",
        "2": "buster",
        "3": "quick",
        "4": "extra",
        "6": "weak",
        "7": "strength",
    };

    const normalizedHitsDistribution = Object.fromEntries(
        Object.entries(svt.hitsDistribution || {}).map(([key, value]) => [
            (cardMap as Record<string, string>)[key] || key,
            value
        ])
    )

    const normalizedCardDetails = Object.fromEntries(
        Object.entries(svt.cardDetails || {}).map(([key, value]) => [
            (cardMap as Record<string, string>)[key] || key,
            value
        ])
    );

    if (faceCard) {
        if (args.arts) {
            cardDamageValue = 1;
            hits = normalizedHitsDistribution.arts ?? [];
            cardDamageRate = normalizedCardDetails.arts?.damageRate ?? 1000;
            cardAttackNPRate = normalizedCardDetails.arts?.attackNpRate ?? 1000;
            cardDropStarRate = normalizedCardDetails.arts?.dropStarRate ?? 1000;
        } else if (args.buster) {
            cardDamageValue = 1.5;
            hits = normalizedHitsDistribution.buster ?? [];
            cardDamageRate = normalizedCardDetails.buster?.damageRate ?? 1000;
            cardAttackNPRate = normalizedCardDetails.buster?.attackNpRate ?? 1000;
            cardDropStarRate = normalizedCardDetails.buster?.dropStarRate ?? 1000;
        } else if (args.quick) {
            cardDamageValue = 0.8;
            hits = normalizedHitsDistribution.quick ?? [];
            cardDamageRate = normalizedCardDetails.quick?.damageRate ?? 1000;
            cardAttackNPRate = normalizedCardDetails.quick?.attackNpRate ?? 1000;
            cardDropStarRate = normalizedCardDetails.quick?.dropStarRate ?? 1000;
        } else if (args.extra) {
            cardDamageValue = 1;
            hits = normalizedHitsDistribution.extra ?? [];
            cardDamageRate = normalizedCardDetails.extra?.damageRate ?? 1000;
            cardAttackNPRate = normalizedCardDetails.extra?.attackNpRate ?? 1000;
            cardDropStarRate = normalizedCardDetails.extra?.dropStarRate ?? 1000;
        }
    } else if (enemyFaceCard) {
        if (args.weak) {
            hits = normalizedHitsDistribution.weak ?? [];
        } else if (args.strength && isEnemy(svt)) {
            hits = normalizedHitsDistribution.strength ?? [];
        }
    }
    // No need for else because default value of hits is npDistribution
    else {
        switch (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card]) {
            case "arts":
                cardDamageValue = 1;
                break;
            case "buster":
                cardDamageValue = 1.5;
                break;
            case "quick":
                cardDamageValue = 0.8;
                break;
            default:
                cardDamageValue = 1;
        }
    }

    // Setting positional bonus for cardDamageValue as well as firstCardBonus and extraCardModifier
    // Setting first card
    let artsFirst = false,
        busterFirst = false,
        quickFirst = false;

    if (faceCard && ((args.arts && !(args.second || args.third || args.extra || args.weak || args.strength)) || args.artsFirst)) {
        // Removed `|| (!faceCard && noblePhantasm.card === "arts") `because af only applies for facecards
        artsFirst = true;
    }
    if (faceCard && ((args.buster && !(args.second || args.third || args.extra)) || args.busterFirst || args.busterChain)) {
        //Removed `|| (!faceCard && noblePhantasm.card === "buster")` because bf only applies for facecards
        busterFirst = true;
    }
    if (faceCard && ((args.quick && !(args.second || args.third || args.extra || args.weak || args.strength)) || args.quickFirst)) {
        //Removed `|| (!faceCard && noblePhantasm.card === "quick")` because bf only applies for facecards
        quickFirst = true;
    }
    // Setting busterFirst to false for enemyCollection and enemyCollectionDetail if not specified
    if (
        args.noBusterFirst ||
        [EntityType.ENEMY_COLLECTION_DETAIL, EntityType.ENEMY_COLLECTION].includes(svt.type) ||
        svt.collectionNo === 0
    ) {
        busterFirst = false;
    }
    if (
        ([EntityType.ENEMY_COLLECTION_DETAIL, EntityType.ENEMY_COLLECTION].includes(svt.type) || svt.collectionNo === 0) &&
        args.busterFirst
    ) {
        busterFirst = true;
    }
    if (args.mightyChain) {
        artsFirst = busterFirst = quickFirst = true;
    }
    if (args.artsFirst) {
        artsFirst = true;
    }
    if (args.busterFirst || args.busterChain) {
        busterFirst = true;
    }
    if (args.quickFirst) {
        quickFirst = true;
    }

    if (faceCard && !args.extra) {
        const tmpCardValue = cardDamageValue;
        if ((args.busterChain && !args.extra) || args.buster || (busterChainMod && !args.extra)) {
            cardDamageValue = 1.5;
        }
        if (args.second) {
            cardDamageValue += tmpCardValue * 0.2;
        }
        if (args.third) {
            cardDamageValue += tmpCardValue * 0.4;
        }
    }

    cardDamageValue = isEnemy(svt) && (args.weak || args.strength) ? 1 : cardDamageValue;
    cardDamageValue = args.cardValue ?? cardDamageValue;

    if (args.extra) {
        extraCardModifier = 2;
    }
    if (busterFirst) {
        firstCardBonus = f32(0.5);
    }
    if (args.busterChain && args.extra) extraCardModifier = 3.5;

    extraCardModifier = (args.extraCardModifier as 1 | 2 | 3.5) ?? extraCardModifier;

    if (firstCardBonus === 0.5 && args.noBusterFirst) firstCardBonus = 0;

    firstCardBonus = faceCard ? firstCardBonus : 0;

    npDamageMultiplier = faceCard || enemyFaceCard ? 1 : npDamageMultiplier;
    ocDamageMultiplier = faceCard || enemyFaceCard ? 1 : ocDamageMultiplier;

    //--- Setting card display name
    let cardName: "NP" | "Arts" | "Buster" | "Quick" | "Extra" | "Weak" | "Strength" = "NP";
    if (args.arts) cardName = "Arts";
    if (args.buster) cardName = "Buster";
    if (args.quick) cardName = "Quick";
    if (args.extra) cardName = "Extra";
    if (args.weak) cardName = "Weak";
    if (args.strength) cardName = "Strength";

    //--- Setting up hitcount override

    const hitCountOverride = args.hitCountOverride ?? 0,
        hitMultiplier = args.hitMultiplier ?? 0;

    if (hitMultiplier) {
        hits = overrideHitCounts(hits, hits.length * hitMultiplier);
    }

    if (hitCountOverride) {
        hits = overrideHitCounts(hits, hitCountOverride);
    }

    //--- Refund terms
    const offensiveNPRate = f32(
        (noblePhantasm as NoblePhantasm.NoblePhantasm).npGain?.[cardName.toLowerCase() as keyof NoblePhantasmGain]?.[args.npLevel - 1] ?? 0
    );
    let npChargeRateMod = f32(args.npGain ?? 0) / f32(100);
    let cardNPValue;

    //--- Stargen terms
    const enemyStarDropMod = 0 as const;
    const baseStarRate = f32(svt.starGen / 1000);

    let cardStarValue: number;

    //--- Setting up stargen terms

    cardStarValue = f32(
        (faceCard && args.quick) || (!faceCard && cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "quick") ? 0.8 : 0
    );
    cardStarValue = f32(
        (faceCard && args.buster) || (!faceCard && cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "buster") ? 0.1 : cardStarValue
    );

    if (args.second && faceCard) {
        cardStarValue += f32(0.05 * (args.quick ? 10 : 1));
    } else if (args.third && faceCard) {
        cardStarValue += f32(0.05 * (args.quick ? 20 : 2));
    }

    if (args.arts) {
        cardStarValue = 0;
    }

    if (args.extra) {
        cardStarValue = f32(1);
    }

    if (faceCard && ((args.quick && !(args.second || args.third)) || args.quickFirst)) {
        quickFirst = true;
    }

    let serverRate: number;

    switch (enemyClass) {
        case "archer":
            serverRate = f32(0.05);
            break;
        case "lancer":
            serverRate = f32(-0.05);
            break;
        case "rider":
            serverRate = f32(0.1);
            break;
        case "assassin":
            serverRate = f32(-0.1);
            break;
        case "avenger":
            serverRate = f32(-0.1);
            break;
        case "alterego":
            serverRate = f32(0.05);
            break;
        case "foreigner":
            serverRate = f32(0.2);
            break;
        case "pretender":
            serverRate = f32(-0.1);
            break;
        default:
            serverRate = f32(0);
    }

    serverRate = f32(args.enemyServerRate ?? serverRate);

    let starDropMod = f32(args.starGen ?? 0) / f32(100);

    //--- Adding passive skills to buffs
    /** Servant passive skills that affect card damage/refund/stars */
    const passiveSkills = getPassivesFromServant(svt);

    if (args.quick || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "quick" && !faceCard)) {
        critDamageMod += f32(passiveSkills.quickCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.quickMod ?? 0) / f32(100);
    } else if (args.arts || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "arts" && !faceCard)) {
        critDamageMod += f32(passiveSkills.artsCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.artsMod ?? 0) / f32(100);
    } else if (args.buster || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "buster" && !faceCard)) {
        critDamageMod += f32(passiveSkills.busterCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.busterMod ?? 0) / f32(100);
    }

    dmgPlusAdd += f32(passiveSkills.flatDamage ?? 0);

    if ((svt.collectionNo === 307 && args.arts) || svt.collectionNo !== 307 /* Crane arts sg passive | Non-crane general sg passives */) {
        starDropMod += f32(passiveSkills.starGen ?? 0) / f32(100);
    }

    if (
        (svt.collectionNo === 362 && (args.quick || !faceCard)) ||
        svt.collectionNo !== 362 /* Sen-no-Rikyū quick ng passive | Non-Sen-no-Rikyū general ng passives */
    ) {
        npChargeRateMod += f32(passiveSkills.npGain ?? 0) / f32(100);
    }

    if (passiveSkills.npMod !== undefined && passiveSkills.npMod > 0) {
        npDamageMod += f32(passiveSkills.npMod) / f32(100);
    } else if (passiveSkills.npMod !== undefined && passiveSkills.npMod < 0) {
        npDamageDownMod += f32(passiveSkills.npMod) / f32(100);
    }

    if (args.arts) critDamageMod += f32(args.artsCritDamageMod ?? 0) / f32(100);
    if (args.buster) critDamageMod += f32(args.busterCritDamageMod ?? 0) / f32(100);
    if (args.quick) critDamageMod += f32(args.quickCritDamageMod ?? 0) / f32(100);

    if (args.arts || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "arts" && !faceCard)) {
        cardMod += f32(args.artsMod ?? 0) / f32(100);
        cardPower += f32(args.artsCardPower ?? 0) / f32(100);
    }
    if (args.buster || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "buster" && !faceCard)) {
        cardMod += f32(args.busterMod ?? 0) / f32(100);
        cardPower += f32(args.busterCardPower ?? 0) / f32(100);
    }
    if (args.quick || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "quick" && !faceCard)) {
        cardMod += f32(args.quickMod ?? 0) / f32(100);
        cardPower += f32(args.quickCardPower ?? 0) / f32(100);
    }
    if (args.extra) {
        cardMod += f32(args.extraMod ?? 0) / f32(100);
        cardPower += f32(args.extraCardPower ?? 0) / f32(100);
    }

    if (args.superbg || args.superscope || args.supersumo || args.superad || args.superhns || args.superfondant)
        servantAtk += args.totalAttack ? 0 : 2000;

    if (args.superbg) {
        servantAtk += args.totalAttack ? 0 : 400;
        npDamageMod += 0.8;
    }

    if (args.superad) {
        if (args.buster || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "buster" && !faceCard)) cardMod += 0.1;

        npDamageMod += 0.1;
    }

    if (args.superof) {
        if (args.arts || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "arts" && !faceCard)) cardMod += 0.08;

        npDamageMod += 0.15;
    }

    if (args.superck) {
        if (args.buster || (cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] === "buster" && !faceCard)) cardMod += 0.08;

        npDamageMod += 0.15;
    }

    if (args.superhns) {
        if (isCritical && faceCard) critDamageMod += 0.15;

        npDamageMod += 0.15;
    }

    if (args.supersumo) {
        atkMod += 0.15;
    }

    if (args.superfondant) {
        powerMod += 0.3;
    }

    if (args.classScoreMax) {
        if (args.buster) critDamageMod += 0.2;
        if (args.arts) critDamageMod += 0.4;
        if (args.quick) critDamageMod += 0.6;
        if (args.extra && faceCard) cardMod += 0.5;

        if (!args.extra) cardPower += 0.2;

        npDamageMod += 0.1;

        starDropMod += 0.5;

        critDamageMod += 0.1;
    }

    //--- Setting up refund terms
    switch ((cardName === "NP" ? cardMap[(noblePhantasm as NoblePhantasm.NoblePhantasm).card] ?? "" : cardName).toLowerCase()) {
        case "arts":
            cardNPValue = 3;
            break;
        case "buster":
            cardNPValue = 0;
            break;
        case "quick":
            cardNPValue = 1;
            break;
        case "extra":
            cardNPValue = 1;
            break;
        default:
            cardNPValue = 1;
            break;
    }

    if (args.second && faceCard) cardNPValue *= 1.5;
    if (args.third && faceCard) cardNPValue *= 2;

    if (
        (([3, 4.5, 6].includes(cardNPValue) || args.arts) && !(args.second || args.third || args.extra || args.weak || args.strength)) ||
        args.artsFirst
    )
        artsFirst = true;
    if (!faceCard) artsFirst = false;

    cardNPValue = f32(args.cardRefundValue ?? cardNPValue);

    let enemyServerMod: number;

    switch (enemyClass) {
        case "rider":
            enemyServerMod = 1.1;
            break;
        case "caster":
            enemyServerMod = 1.2;
            break;
        case "assassin":
            enemyServerMod = 0.9;
            break;
        case "berserker":
            enemyServerMod = 0.8;
            break;
        case "moonCancer":
            enemyServerMod = 1.2;
            break;
        default:
            enemyServerMod = 1;
            break;
    }

    enemyServerMod = f32(args.enemyServerMod ?? enemyServerMod);

    //---NP Damage Buff Strength Modifier (Oberon S3)

    if (args.npPower !== undefined) {
        let npPower = f32(args.npPower) / f32(100);

        if (npPower > 4) {
            //---Enforce npPower cap
            warnMessage += "Value for npPower exceeds cap (400%), setting to capped value.\n";
            npPower = f32(4);
        }

        npDamageMod = f32(f32(npDamageMod) * f32(f32(1) + f32(npPower)));
    }

    //---Finally adding NP Damage Down debuffs
    npDamageMod = f32(f32(npDamageMod) + f32(npDamageDownMod));

    //---Enforce buff caps
    if (atkMod > 4) {
        warnMessage += "Value for atkMod exceeds cap (400%), setting to capped value.\n";
        atkMod = f32(4);
    }
    if (defMod < -1) {
        warnMessage += "Value for defMod exceeds cap (-100%), setting to capped value.\n";
        defMod = f32(-1);
    }
    if (cardMod > 4) {
        warnMessage += "Value for cardMod exceeds cap (400%), setting to capped value.\n";
        cardMod = f32(4);
    }
    if (powerMod > 10) {
        warnMessage += "Value for powerMod exceeds cap (1000%), setting to capped value.\n";
        powerMod = f32(10);
    }
    if (critDamageMod > 5) {
        warnMessage += "Value for critDamageMod exceeds cap (500%), setting to capped value.\n";
        critDamageMod = f32(5);
    }
    if (npDamageMod > 5) {
        warnMessage += "Value for npDamageMod exceeds cap (500%), setting to capped value.\n";
        npDamageMod = f32(5);
    }
    if (npChargeRateMod > 4) {
        warnMessage += "Value for npChargeRateMod exceeds cap (400%), setting to capped value.\n";
        npChargeRateMod = f32(4);
    }
    if (starDropMod > 5) {
        warnMessage += "Value for starDropMod exceeds cap (500%), setting to capped value.\n";
        starDropMod = f32(5);
    }

    //--- Misc
    const verbosity: "nv" | "" | "v" | "vv" | "vvv" = args.nonVerbose
        ? "nv"
        : ("v".repeat(args.verboseLevel ?? 0) as "" | "v" | "vv" | "vvv");

    let cardPosition: "first" | "second" | "third" | "extra" | "none" = "none";

    if (args.first || !(args.second || args.third || args.extra || args.weak || args.strength)) cardPosition = "first";
    else if (args.second) cardPosition = "second";
    else if (args.third) cardPosition = "third";
    else if (args.extra) cardPosition = "extra";

    if (isEnemy(svt) || (!isEnemy(svt) && !faceCard)) cardPosition = "none";

    let servantThumbnail = [101700, 703600].includes(svt.id)
        ? "https://static.atlasacademy.io/file/aa-fgo-extract-na/Faces/DownloadFace/DownloadFaceAtlas1/f_1000012.png"
        : svt.extraAssets.faces.ascension?.[4] ??
          svt.extraAssets.faces.ascension?.[3] ??
          svt.extraAssets.faces.ascension?.[2] ??
          svt.extraAssets.faces.ascension?.[1] ??
          "";

    if (svt.id === 604400 /** Hildr (Assassin) */) {
        servantThumbnail = "https://static.atlasacademy.io/JP/Faces/f_6044300.png";
    }

    if (svt.id === 205000 /* Ptolemy */) {
        /**
         * Ptolemy has 2 NPs, one ST and one AoE; the latter of which is only available at Ascension 3.
         * To improve clarity on which NP is being used currently, the face is changed to reflect the Ascension level(s) at which each is available.
         * If `Pharos Tis Alexandreias` (205001) is used, set face from first/base Ascension.
         * if `Bibliotheca Basileus` (205002) is used, set face from final Ascension.
         */

        if (!faceCard) {
            if (noblePhantasm.id === 205001) {
                servantThumbnail = "https://static.atlasacademy.io/JP/Faces/f_2050000.png";
            } else if (noblePhantasm.id === 205002) {
                servantThumbnail = "https://static.atlasacademy.io/JP/Faces/f_2050003.png";
            }
        } else {
            // Setting to base face to reduce confusion
            servantThumbnail = "https://static.atlasacademy.io/JP/Faces/f_2050000.png";
        }
    }

    /**
     * Object describing the various terms in the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula
     * (as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
     * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas, if applicable)
     * in addition to some internals
     */
    const calcTerms: CalcTerms = {
        //--- Damage
        servantAtk,
        cardDamageRate,
        npDamageMultiplier,
        ocNpHitsPresent,
        ocDamageMultiplier,
        firstCardBonus,
        cardDamageValue,
        cardMod,
        cardPower,
        classAtkBonus,
        triangleModifier,
        attributeModifier,
        atkMod,
        defMod,
        isCritical,
        faceCard,
        criticalModifier: (2 - +!(isCritical && (faceCard || enemyFaceCard))) as 1 | 2,
        extraCardModifier,
        specialDefMod,
        damageSpecialMod,
        powerMod,
        selfDamageMod,
        critDamageMod,
        npDamageMod,
        superEffectiveModifier,
        dmgPlusAdd,
        selfDmgCutAdd,
        busterChainMod,

        //--- Refund
        offensiveNPRate,
        cardAttackNPRate,
        cardNPValue,
        enemyServerMod,
        npChargeRateMod,
        overkillModifier: 1.5,
        flatRefund: f32(args.flatRefund ?? 0),

        //--- Stargen
        baseStarRate,
        cardDropStarRate,
        cardStarValue,
        serverRate,
        starDropMod,
        enemyStarDropMod,
        overkillAdd: 0.3,
        flatStars: f32(args.flatStars ?? 0),

        //--- Misc & internal
        artsFirst,
        busterFirst,
        quickFirst,
        cardName: cardName === "NP" ? (noblePhantasm?.card as unknown as typeof cardName) ?? "NP" : cardName,
        cardPosition,
        enemyAttribute,
        enemyClass,
        enemyFaceCard,
        ...(args.enemyHp !== undefined ? { enemyHp: f32(args.enemyHp) } : {}),
        hits,
        ...(args.reducedHp !== undefined ? { reducedHp: f32(args.reducedHp) } : {}),
        ...(args.rng !== undefined ? { rng: f32(args.rng) } : {}),
        servantName,
        servantClass: svt.className,
        ...(faceCard || enemyFaceCard ? {} : { npName: noblePhantasm.name }),
        warnMessage,
        verbosity,
        fou: args.fou,
        fouPaw: args.fouPaw ?? 0,
        level: args.level,
        npLevel: args.npLevel,
        strengthen: !!+npNumber,
        ce: args.ce,
        mightyChain: !!args.mightyChain,
        isEnemy: isEnemy(svt),
        servantURL: `https://apps.atlasacademy.io/db/JP/${isEnemy(svt) ? "enemy" : "servant"}/${svt.id}`,
        servantType: svt.type,
        servantThumbnail,
        calcString: args.calcString ?? "",
    };

    return calcTerms;
};

/**
 * Applies the damage formula for the given calcTerms and damage range
 * @param damage The lowroll damage to calc refund per hit for
 * @param calcTerms The {@link CalcTerms} object containing the terms to be plugged into the formula
 * @returns object describing the results of the damage calculation
 */
const getDamageFields = (calcTerms: CalcTerms, calcOCDamage = false) => {
    const {
        servantAtk,
        cardDamageRate,
        npDamageMultiplier,
        ocDamageMultiplier,
        firstCardBonus,
        cardDamageValue,
        cardMod,
        cardPower,
        classAtkBonus,
        triangleModifier,
        attributeModifier,
        atkMod,
        defMod,
        criticalModifier,
        isCritical,
        extraCardModifier,
        specialDefMod,
        damageSpecialMod,
        powerMod,
        selfDamageMod,
        critDamageMod,
        npDamageMod,
        faceCard,
        enemyFaceCard,
        superEffectiveModifier,
        dmgPlusAdd,
        selfDmgCutAdd,
        busterChainMod,

        hits,
    } = calcTerms;

    let damage = 0;
    let minrollDamage = 0;
    let maxrollDamage = 0;

    /** Base multiplicative damage */
    const rawDamage = f32(
        f32(servantAtk) *
            f32(f32(cardDamageRate) / f32(1000)) *
            f32(calcOCDamage ? ocDamageMultiplier : npDamageMultiplier) *
            f32(f32(firstCardBonus) + f32(cardDamageValue) * f32(Math.max(1 + f32(cardMod) + f32(cardPower), 0))) *
            f32(classAtkBonus) *
            f32(triangleModifier) *
            f32(attributeModifier) *
            f32(0.23) *
            f32(Math.max(1 + f32(atkMod) - f32(defMod), 0)) *
            f32(criticalModifier) *
            f32(extraCardModifier) *
            f32(Math.max(1 - f32(specialDefMod), 0)) *
            f32(Math.max(1 + damageSpecialMod, f32(0.001))) *
            f32(
                Math.max(
                    1 +
                        f32(powerMod) +
                        f32(selfDamageMod) +
                        f32(critDamageMod * +isCritical) +
                        f32(npDamageMod * +!(faceCard || enemyFaceCard)),
                    0.001
                )
            ) *
            f32(1 + f32(f32(superEffectiveModifier) * +!(faceCard || enemyFaceCard))) // 100% already subtracted from semod after parsing
    );

    const damageAdd = f32(
        // dmgPlusAdd will only be -Infinity in case of non-damage NPs; this internally gets around support NPs for servants with flat damage passives
        f32(dmgPlusAdd === -Infinity ? 0 : dmgPlusAdd) + f32(selfDmgCutAdd) + f32(servantAtk * f32(busterChainMod * +faceCard))
    );

    // Distributing the damage after flooring (???)
    const total = Math.floor(f32(rawDamage + damageAdd));

    for (const hit of hits.slice(0, hits.length - 1)) {
        damage += f32(f32(total) * f32(f32(f32(hit) / f32(100)))); //add until second-to-last, then add the difference
    }

    damage += f32(f32(total) - f32(damage));
    damage = Math.floor(f32(Math.max(f32(damage), 0)));

    minrollDamage = Math.floor(f32(Math.max(f32(0.9) * f32(rawDamage) + f32(damageAdd), 0)));
    maxrollDamage = Math.floor(f32(Math.max(f32(1.099) * f32(rawDamage) + f32(damageAdd), 0)));

    return {
        /** Raw damage after multiplicative calcs */
        rawDamage,

        /** Flat damage added post multiplicative calcs */
        damageAdd,

        /** Midrange damage */
        damage,
        /** Minroll damage */
        minrollDamage,
        /** Maxroll damage */
        maxrollDamage,
    };
};

/**
 * Applies the refund formula for the given calcTerms and damage range
 * @param damage The lowroll damage to calc refund per hit for
 * @param calcTerms The {@link CalcTerms} object containing the terms to be plugged into the formula
 * @returns Partial<{@link NPFields}> object describing the results of the refund formula
 */
const getNPFields = (damage: number, calcTerms: CalcTerms): NPFields => {
    const {
        reducedHp: argReducedHp = 0,
        enemyHp,
        hits,
        offensiveNPRate,
        cardAttackNPRate,
        artsFirst,
        faceCard,
        cardNPValue,
        cardMod,
        enemyServerMod,
        npChargeRateMod,
        criticalModifier,
        overkillModifier,
        flatRefund,
        isCritical,
    } = calcTerms as Required<CalcTerms>;

    let NPRegen = 0,
        overkillNo = 0,
        reducedHp = argReducedHp,
        isOverkill = false;

    const npPerHit: number[] = [],
        damagePerHit: number[] = [],
        remHPPerHit: number[] = [];

    let baseNPGain = 0;

    let thisCardDamage = 0;

    for (let hitNo = 0; hitNo < hits.length; hitNo++) {
        const hit = hits[hitNo];

        let thisHitDamage = Math.floor(f32((f32(damage) * f32(hit)) / f32(100)));

        if (hitNo === hits.length - 1) {
            thisHitDamage = damage - thisCardDamage;
        }

        reducedHp += thisHitDamage;
        isOverkill = reducedHp >= enemyHp;
        overkillNo += +isOverkill;

        baseNPGain = Math.floor(
            f32(
                f32(offensiveNPRate) *
                    f32(cardAttackNPRate / 1000) *
                    f32(f32(+(artsFirst && faceCard)) + f32(f32(cardNPValue) * f32(Math.max(1 + cardMod, 0)))) *
                    f32(enemyServerMod) *
                    f32(Math.max(1 + npChargeRateMod, 0)) *
                    criticalModifier
            )
        );

        const thisHitRegen = Math.max(Math.floor(f32(baseNPGain) * f32((isOverkill && overkillModifier) || 1)) / 100, 0);

        npPerHit.push(thisHitRegen);
        damagePerHit.push(Math.floor(thisHitDamage));
        remHPPerHit.push(enemyHp - reducedHp);

        NPRegen += thisHitRegen;

        thisCardDamage += thisHitDamage;
    }

    NPRegen += flatRefund;

    const minNPFields = {
        offensiveNPRate,
        cardAttackNPRate,
        artsFirst,
        cardNPValue,
        cardMod,
        enemyServerMod,
        npChargeRateMod,
        isCritical,
        isOverkill,
        NPRegen,
        reducedHp,
        enemyHp: enemyHp as number,
        overkillNo,
        npPerHit,
        damagePerHit,
        remHPPerHit,
    };

    return minNPFields;
};

/**
 * @param damage The damage to calc stars per hit for
 * @param calcTerms The {@link CalcTerms } object containing the terms to be plugged into the formula
 * @returns Partial<{{@link StarFields }}> describing the results of the stargen formula
 */
const getStarFields = (damage: number, calcTerms: CalcTerms): StarFields => {
    const {
        reducedHp: argReducedHp = 0,
        hits,
        enemyHp,
        baseStarRate,
        cardDropStarRate,
        quickFirst,
        faceCard,
        cardStarValue,
        cardMod,
        serverRate,
        starDropMod,
        enemyStarDropMod,
        isCritical,
        flatStars,
    } = calcTerms as Required<CalcTerms>;

    let reducedHp = argReducedHp,
        isOverkill = false,
        minStars = 0,
        maxStars = 0;

    let overkillNo = 0;

    const dropChancePerHit: number[] = [];

    let thisCardDamage = 0;

    for (let hitNo = 0; hitNo < hits.length; hitNo++) {
        const hit = hits[hitNo];

        let thisHitDamage = Math.floor(f32((damage * f32(hit)) / f32(100)));

        if (hitNo === hits.length - 1) {
            thisHitDamage = damage - thisCardDamage;
        }

        reducedHp += thisHitDamage;
        isOverkill = reducedHp > enemyHp;
        overkillNo += +isOverkill;

        const dropChance = Math.min(
            f32(
                f32(
                    f32(baseStarRate) +
                        f32(quickFirst && faceCard ? f32(0.2) : f32(0)) +
                        f32(f32(cardStarValue) * f32(Math.max(f32(1) + f32(cardMod), 0))) +
                        f32(serverRate) +
                        f32(starDropMod) +
                        f32(enemyStarDropMod) +
                        f32(f32(0.2) * +isCritical)
                ) *
                    f32(cardDropStarRate / 1000) +
                    f32(f32(0.3) * +isOverkill)
            ),
            3
        );

        minStars += Math.max(Math.floor(dropChance), 0);
        maxStars += Math.max(Math.ceil(dropChance), 0);

        dropChancePerHit.push(dropChance);

        thisCardDamage += thisHitDamage;
    }

    minStars += flatStars;
    maxStars += flatStars;

    const avgStars = Math.floor(f32((minStars + maxStars) / 2));

    const starFields: StarFields = {
        baseStarRate,
        cardDropStarRate,
        quickFirst,
        cardStarValue,
        cardMod,
        serverRate,
        starDropMod,
        enemyStarDropMod,
        reducedHp,
        isCritical,
        isOverkill,
        overkillNo,
        minStars,
        maxStars,
        avgStars,
        dropChancePerHit,
    };
    return starFields;
};

/**
 * Applies the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula,
 * as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas if applicable, to the given {@link CalcTerms} object
 * @param calcTerms The {@link CalcTerms} object describing the various values to be plugged into the damage, refund and stargen formulas
 * @returns A {@link CalcVals} object describing min/maxroll damage, refund, stars, etc as well as the input calc terms
 */
const getValsFromTerms = (calcTerms: CalcTerms): CalcVals => {
    const {
        servantAtk,
        npDamageMultiplier,
        ocNpHitsPresent,
        ocDamageMultiplier,
        hits,
        cardDamageValue,
        faceCard,
        enemyFaceCard,
        rng,
        enemyHp,
        fou,
        fouPaw,
        ce,
        isEnemy,
        servantClass,
        servantName,
        servantThumbnail,
        servantType,
        servantURL,
        npName,
        warnMessage,
        verbosity,
    } = calcTerms;

    const generalFields = {
        baseAtk: servantAtk - fou - ce - fouPaw,
        damageMultiplier: faceCard || enemyFaceCard ? cardDamageValue : npDamageMultiplier,
        ...(ocNpHitsPresent ? { ocDamageMultiplier } : {}),
        isEnemy,
        servantClass,
        servantName,
        servantThumbnail,
        servantURL,
        servantType,
        ...(npName ? { npName } : {}),
        verbosity,
        warnMessage,
    };

    let rngToKill = "";

    const hasRefundOrStars = ((enemyHp: CalcTerms["enemyHp"]): enemyHp is number => (enemyHp === undefined ? false : true))(enemyHp);

    const { rawDamage, damageAdd, damage, minrollDamage, maxrollDamage } = getDamageFields(calcTerms);

    if (hasRefundOrStars) {
        for (let i = 900; i < 1100; i++) {
            if (Math.floor(f32(Math.max(f32(i / 1000) * f32(rawDamage) + f32(damageAdd), 0))) >= (enemyHp ?? Infinity)) {
                const rng = i / 1000;
                rngToKill = `**${rng}x (${((1100 - i) / 2).toFixed(2)}%)**`;
                break;
            }
        }
    }

    const damageFields: DamageFields = {
        damage,
        minrollDamage,
        maxrollDamage,
        rngToKill,
    };

    let customFields: Partial<CustomFields> = {};

    if (rng) {
        customFields = {
            rng,
            damage: Math.floor(f32(Math.max(f32(rng) * f32(rawDamage) + f32(damageAdd), 0))),
        };

        if (hasRefundOrStars) {
            customFields.NPFields = getNPFields(customFields?.damage ?? 0, calcTerms);
            customFields.StarFields = getStarFields(customFields?.damage ?? 0, calcTerms);
        }
    }

    let minNPFields: Partial<NPFields> = {},
        maxNPFields: Partial<NPFields> = {};

    if (hasRefundOrStars) {
        minNPFields = getNPFields(minrollDamage, calcTerms);
        maxNPFields = getNPFields(maxrollDamage, calcTerms);
    }

    let minStarFields: Partial<StarFields> = {},
        maxStarFields: Partial<StarFields> = {};

    if (hasRefundOrStars) {
        minStarFields = getStarFields(minrollDamage, calcTerms);
        maxStarFields = getStarFields(maxrollDamage, calcTerms);
    }

    if (ocNpHitsPresent && !faceCard) {
        const {
            rawDamage: ocRawDamage,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            damageAdd: ocDamageAdd,
            damage: ocDamage,
            minrollDamage: ocMinrollDamage,
            maxrollDamage: ocMaxrollDamage,
        } = getDamageFields(calcTerms, true);

        if (hasRefundOrStars) {
            if (rng !== undefined && customFields.damage !== undefined && customFields.damage < enemyHp) {
                const ocCustomDamage = Math.floor(f32(Math.max(f32(rng) * f32(ocRawDamage) + f32(ocDamageAdd), 0)));
                const ocEnemyHp = enemyHp - ocCustomDamage;

                customFields.damage = (customFields.damage ?? 0) + ocCustomDamage;

                // Pass the original hits to avoid doubling the hits twice
                const ocCustomNPFields = getNPFields(ocCustomDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits }),
                    ocCustomStarFields = getStarFields(ocCustomDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits });

                if (customFields.NPFields == undefined) {
                    customFields.NPFields = {
                        NPRegen: 0,
                        damagePerHit: [],
                        enemyHp: 0,
                        npPerHit: [],
                        isOverkill: false,
                        overkillNo: 0,
                        reducedHp: 0,
                        remHPPerHit: [],
                        offensiveNPRate: 0,
                        artsFirst: false,
                        cardMod: 0,
                        cardNPValue: 0,
                        enemyServerMod: 0,
                        npChargeRateMod: 0,
                        isCritical: false,
                    };
                }
                if (customFields.StarFields == undefined) {
                    customFields.StarFields = {
                        minStars: 0,
                        avgStars: 0,
                        maxStars: 0,
                        dropChancePerHit: [],
                        isOverkill: false,
                        overkillNo: 0,
                        reducedHp: 0,
                        cardMod: 0,
                        cardStarValue: 0,
                        enemyStarDropMod: 0,
                        serverRate: 0,
                        baseStarRate: 0,
                        cardDropStarRate: 0,
                        starDropMod: 0,
                        quickFirst: false,
                        isCritical: false,
                    };
                }

                customFields.NPFields.NPRegen = (customFields.NPFields?.NPRegen ?? 0) + ocCustomNPFields.NPRegen;
                customFields.NPFields.damagePerHit = [...(customFields.NPFields?.damagePerHit ?? []), ...ocCustomNPFields.damagePerHit];
                customFields.NPFields.enemyHp = ocEnemyHp;
                customFields.NPFields.npPerHit = [...(customFields.NPFields?.npPerHit ?? []), ...ocCustomNPFields.npPerHit];
                customFields.NPFields.isOverkill ||= ocCustomNPFields.isOverkill;
                customFields.NPFields.overkillNo = (customFields.NPFields?.overkillNo ?? 0) + ocCustomNPFields.overkillNo;
                customFields.NPFields.reducedHp = (customFields.NPFields?.reducedHp ?? 0) + ocCustomNPFields.reducedHp;
                customFields.NPFields.remHPPerHit = [...(customFields.NPFields?.remHPPerHit ?? []), ...ocCustomNPFields.remHPPerHit];

                customFields.StarFields.minStars = (customFields.StarFields.minStars ?? 0) + ocCustomStarFields.minStars;
                customFields.StarFields.avgStars = (customFields.StarFields.avgStars ?? 0) + ocCustomStarFields.avgStars;
                customFields.StarFields.maxStars = (customFields.StarFields.maxStars ?? 0) + ocCustomStarFields.maxStars;
                customFields.StarFields.dropChancePerHit = [
                    ...(customFields.StarFields.dropChancePerHit ?? []),
                    ...ocCustomStarFields.dropChancePerHit,
                ];
                customFields.StarFields.isOverkill ||= ocCustomStarFields.isOverkill;
                customFields.StarFields.overkillNo = (customFields.StarFields.overkillNo ?? 0) + ocCustomStarFields.overkillNo;
                customFields.StarFields.reducedHp = (customFields.StarFields.reducedHp ?? 0) + ocCustomStarFields.reducedHp;

                customFields.damage += ocCustomDamage;

                for (let i = 900; i < 1100; i++) {
                    if (
                        Math.floor(f32(Math.max(f32(i / 1000) * f32(rawDamage + ocRawDamage) + f32(damageAdd + ocDamage), 0))) >=
                        enemyHp - minrollDamage
                    ) {
                        const gongRng = i / 1000;
                        rngToKill = `**${gongRng}x (${((1100 - i) / 2).toFixed(2)}%)**`;
                        break;
                    }
                }
            }

            if (minrollDamage < enemyHp) {
                const ocEnemyHp = enemyHp - minrollDamage;

                // Pass the original hits to avoid doubling the hits twice
                const ocMinNPFields = getNPFields(ocMinrollDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits }),
                    ocMinStarFields = getStarFields(ocMinrollDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits });

                minNPFields.NPRegen = (minNPFields.NPRegen ?? 0) + ocMinNPFields.NPRegen;
                minNPFields.damagePerHit = [...(minNPFields.damagePerHit ?? []), ...ocMinNPFields.damagePerHit];
                minNPFields.enemyHp = ocEnemyHp;
                minNPFields.npPerHit = [...(minNPFields.npPerHit ?? []), ...ocMinNPFields.npPerHit];
                minNPFields.isOverkill ||= ocMinNPFields.isOverkill;
                minNPFields.overkillNo = (minNPFields.overkillNo ?? 0) + ocMinNPFields.overkillNo;
                minNPFields.reducedHp = (minNPFields.reducedHp ?? 0) + ocMinNPFields.reducedHp;
                minNPFields.remHPPerHit = [...(minNPFields.remHPPerHit ?? []), ...ocMinNPFields.remHPPerHit];

                minStarFields.minStars = (minStarFields.minStars ?? 0) + ocMinStarFields.minStars;
                minStarFields.avgStars = (minStarFields.avgStars ?? 0) + ocMinStarFields.avgStars;
                minStarFields.maxStars = (minStarFields.maxStars ?? 0) + ocMinStarFields.maxStars;
                minStarFields.dropChancePerHit = [...(minStarFields.dropChancePerHit ?? []), ...ocMinStarFields.dropChancePerHit];
                minStarFields.isOverkill ||= ocMinStarFields.isOverkill;
                minStarFields.overkillNo = (minStarFields.overkillNo ?? 0) + ocMinStarFields.overkillNo;
                minStarFields.reducedHp = (minStarFields.reducedHp ?? 0) + ocMinStarFields.reducedHp;

                damageFields.minrollDamage += ocMinrollDamage;
                damageFields.damage += ocDamage;

                for (let i = 900; i < 1100; i++) {
                    if (
                        Math.floor(f32(Math.max(f32(i / 1000) * f32(rawDamage + ocRawDamage) + f32(damageAdd + ocDamage), 0))) >=
                        enemyHp - minrollDamage
                    ) {
                        const iRng = i / 1000;
                        rngToKill = `**${iRng}x (${((1100 - i) / 2).toFixed(2)}%)**`;
                        break;
                    }
                }

                // Once the calculations are over, the hits distribution array can be modified
                // (so as not to interfere with the ongoing NP, star and damage calcs while still maintaining post-processing accuracy)
                calcTerms.hits = [...hits, ...hits];
            }

            if (maxrollDamage < enemyHp) {
                const ocEnemyHp = enemyHp - maxrollDamage;

                // Pass the original hits to avoid doubling the hits twice
                const ocMaxNPFields = getNPFields(ocMaxrollDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits }),
                    ocMaxStarFields = getStarFields(ocMaxrollDamage, { ...calcTerms, enemyHp: ocEnemyHp, hits });

                maxNPFields.NPRegen = (maxNPFields.NPRegen ?? 0) + ocMaxNPFields.NPRegen;
                maxNPFields.damagePerHit = [...(maxNPFields.damagePerHit ?? []), ...ocMaxNPFields.damagePerHit];
                maxNPFields.enemyHp = ocEnemyHp;
                maxNPFields.npPerHit = [...(maxNPFields.npPerHit ?? []), ...ocMaxNPFields.npPerHit];
                maxNPFields.isOverkill ||= ocMaxNPFields.isOverkill;
                maxNPFields.overkillNo = (maxNPFields.overkillNo ?? 0) + ocMaxNPFields.overkillNo;
                maxNPFields.reducedHp = (maxNPFields.reducedHp ?? 0) + ocMaxNPFields.reducedHp;
                maxNPFields.remHPPerHit = [...(maxNPFields.remHPPerHit ?? []), ...ocMaxNPFields.remHPPerHit];

                maxStarFields.minStars = (maxStarFields.minStars ?? 0) + ocMaxStarFields.minStars;
                maxStarFields.avgStars = (maxStarFields.avgStars ?? 0) + ocMaxStarFields.avgStars;
                maxStarFields.maxStars = (maxStarFields.maxStars ?? 0) + ocMaxStarFields.maxStars;
                maxStarFields.dropChancePerHit = [...(maxStarFields.dropChancePerHit ?? []), ...ocMaxStarFields.dropChancePerHit];
                maxStarFields.isOverkill ||= ocMaxStarFields.isOverkill;
                maxStarFields.overkillNo = (maxStarFields.overkillNo ?? 0) + ocMaxStarFields.overkillNo;
                maxStarFields.reducedHp = (maxStarFields.reducedHp ?? 0) + ocMaxStarFields.reducedHp;

                damageFields.maxrollDamage += ocMaxrollDamage;

                // If minrollDamage < enemyHp then the previous block containing the addition of oc damage to mean damage has already run
                // Therefore there is no need to add the ocDamage to the mean damage again
                // However, if !(minrollDamage < enemyHp) then the previous block has not run, meaning the damage has to be added again
                if (!(minrollDamage < enemyHp)) {
                    damageFields.damage += ocDamage;
                }

                for (let i = 900; i < 1100; i++) {
                    if (
                        Math.floor(f32(Math.max(f32(i / 1000) * f32(rawDamage + ocRawDamage) + f32(damageAdd + ocDamage), 0))) >=
                        enemyHp - minrollDamage
                    ) {
                        const iRng = i / 1000;
                        damageFields.rngToKill = `**${iRng}x (${((1100 - i) / 2).toFixed(2)}%)**`;
                        break;
                    }
                }

                // Once the calculations are over, the hits distribution array can be modified
                // (so as not to interfere with the ongoing NP, star and damage calcs while still maintaining post-processing accuracy)
                calcTerms.hits = [...hits, ...hits];
            }
        }
    }

    return {
        calcTerms,
        generalFields,
        damageFields,
        customFields,
        minNPFields,
        maxNPFields,
        minStarFields,
        maxStarFields,
    } as CalcVals;
};

/**
 * Applies the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula, as well as
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas if applicable,
 * to the given svt ID/C.No. and base command string and returns the resultant vals
 * @param svt The svt to calc for
 * @param baseCommandString The command string to apply to the svt before calcing
 * @returns A {@link CalcVals} object that is obtained after applying the damage, refund and stargen formulas to the given svt
 */
const calc = (svt: Servant.Servant | Enemy.Enemy, baseCommandString: string) => {
    const commandObject = parseBaseCommandString(baseCommandString);
    const calcTerms = commandObjectToCalcTerms(svt, commandObject);
    const calcVals = getValsFromTerms(calcTerms);

    return calcVals;
};

/** Initialise: set svt's NA noble phantasms */
const initNANPs = (NPs: NoblePhantasm.NoblePhantasm[] = []) => {
    NANoblePhantasms = NPs;
};

export { calc, initNANPs as init };
