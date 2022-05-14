import { Enemy, NoblePhantasm, Servant } from "@atlasacademy/api-connector";
import { NoblePhantasmGain } from "@atlasacademy/api-connector/dist/Schema/NoblePhantasm";

import { attributeRelation, classList, classRelation } from "../assets/assets";
import { getPassivesFromServant } from "../helpers/get-passives";
import { parseBaseCommandString } from "../helpers/parse-args";
import { CommandObject } from "./interfaces/command-object.interfaces";
import { CalcTerms, CalcVals, DamageFields, NPFields, StarFields } from "./interfaces/commands.interfaces";

const f32 = (val: number) => Math.fround(val);

/** NA NPs for the given svt, i.e. before any JP ludes */
let NANoblePhantasms: NoblePhantasm.NoblePhantasm[];

/** Checks if a given entity is an enemy:
 * Enemies have `type: "enemy"` by definition, so to check if the given entity is an enemy, simply check that the type is "enemy"
 * @param entity Entity of type {@link Enemy.Enemy} | `{ detail: string }`, to be checked
 * @returns boolean: true if `entity.type === "enemy"`, false otherwise
 */
const isEnemy = (entity: Servant.Servant | Enemy.Enemy): entity is Enemy.Enemy => entity.cardDetails.weak !== undefined;

/**
 * Maps the given CommandObject to promise that resolves to terms that are then passed into the
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage},
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas
 * @param svt The servant or enemy to calulate damage for
 * @param args The {@link CommandObject} obtained after parsing the input command string
 * @param servantName Fallback for the name of the servant or enemy to calulate damage for
 * @returns Object describing the various terms in the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula
 * (as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas, if applicable)
 * for the given args object (reading the linked docs is recommended to follow this function properly)
 */
const commandObjectToCalcTerms = (svt: Servant.Servant | Enemy.Enemy, args: Partial<CommandObject>, servantName?: string): CalcTerms => {
    let warnMessage = args.unknownArgs?.length ? `Unkown args: ${(args.unknownArgs ?? []).join(", ")}\n` : "";

    //--- Base setup
    if (args.npLevel !== undefined && (args.npLevel > 5 || args.npLevel < 1)) {
        warnMessage += "NP Level must be within [1,5]. Setting NP level to 5 (default).\n";
        args.npLevel = 5;
    }
    if (!args.npLevel) {
        args.npLevel = 5;
    }

    args.npLevel = Math.floor(args.npLevel);
    if (args.fou && (args.fou < 0 || args.fou > 2000)) {
        warnMessage += "Fou value cannot be lesser than 0 or greater than 2000. Setting Fou value to 1000 (default).\n";
        args.fou = 1000;
    }
    if (!args.fou) {
        args.fou = isEnemy(svt) ? 0 : 1000;
    }
    args.fou = Math.floor(args.fou);
    if (!args.ce) {
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

    //--- Setting NP to use
    let nps = Object.keys(svt.noblePhantasms),
        naNPs = Object.keys(NANoblePhantasms),
        npNumber: string;

    if (!isEnemy(svt)) {
        nps = Object.keys(svt.noblePhantasms ?? []);
    }

    servantName = servantName ?? svt.name;

    if (svt.collectionNo === 268 || svt.collectionNo === 312) {
        /* Setting default NP for Astarte and Melusine */
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
    if (args.setNp) {
        if (Object.keys(nps).includes(args.setNp as any as string)) {
            npNumber = nps.length ? nps[args.setNp] : "-1";
        } else {
            warnMessage += `${args.setNp} is not in ${servantName}'s NPs. Try \`!l ${svt.collectionNo}\` first.\n`;
        }
    }

    /** The noble phantasm to use */
    let noblePhantasm = svt.noblePhantasms[+npNumber] ?? {};

    let npDamageMultiplier = 0;
    let npFns = (noblePhantasm as NoblePhantasm.NoblePhantasm).functions ?? {};

    for (const [npFnNo, npFn] of npFns.entries()) {
        if (npFn.funcType.includes("damageNp")) {
            npDamageMultiplier = f32(npFn?.svals[args.npLevel - 1].Value ?? 0) / f32(10);
            break;
        }
        if (npFnNo === npFns.length - 1) {
            // If there is no damageNp; setting -Infinity to swallow any flat damage
            args.flatDamage = -Infinity;
        }
    }

    //--- Setting facecard, if any

    let faceCard = !!(!isEnemy(svt) && (args.arts || args.buster || args.quick || args.extra));
    let enemyFaceCard = !!(isEnemy(svt) && (args.weak || args.strength));

    npDamageMultiplier = f32(args.npValue ?? npDamageMultiplier) / f32(100);

    //--- Enemy class and attribute
    let enemyClass = "shielder",
        enemyAttribute = svt.attribute;

    for (const className of Object.keys(classList)) {
        if (args[className.toLowerCase() as keyof CommandObject]) {
            enemyClass = className;
        }
    }
    for (const attribute of Object.keys(attributeRelation)) {
        if (args[attribute.toLowerCase() as keyof CommandObject]) {
            enemyAttribute = attribute as typeof svt.attribute;
        }
    }

    //--- Other terms in the damage formula

    let classAtkBonus = f32((classList[svt.className] ?? 1000) / f32(1000));

    let servantAtk = f32(svt.atkGrowth[args.level - 1]);

    let triangleModifier = f32(args.classOverride ?? (classRelation[svt.className]?.[enemyClass] ?? 1000) / f32(1000));

    let attributeModifier = f32((attributeRelation[svt.attribute]?.[enemyAttribute] ?? 1000) / f32(1000));

    let extraCardModifier: 1 | 2 | 3.5 = args.extra ? 2 : 1;

    let cardMod = args.extra ? f32(0) : f32(args.cardMod ?? 0) / f32(100);

    let cardPower = args.extra ? f32(0) : f32(args.cardPower ?? 0) / f32(100);

    let isCritical = !!((faceCard && args.critical && !args.extra) || (enemyFaceCard && (args.strength || args.critical) && !args.weak));

    let critDamageMod = f32(args.critDamageMod ?? 0) / f32(100);

    let atkMod = f32(args.atkMod ?? 0) / f32(100);

    let defMod = f32(args.defMod ?? 0) / f32(100);

    let specialDefMod = f32(args.specialDefenseMod ?? 0) / f32(100);

    let damageSpecialMod = f32(args.specialAttackMod ?? 0) / f32(100);

    let npDamageMod = f32(args.npMod ?? 0) / f32(100);

    let busterChainMod: 0 | 0.2 = args.busterChain && faceCard && args.buster ? 0.2 : 0;

    let firstCardBonus = 0;

    let superEffectiveModifier = f32((args.superEffectiveMod ?? 100) - 100) / f32(100);

    let powerMod = f32(args.powerMod ?? 0) / f32(100);

    let selfDamageMod: 0 = 0;

    let dmgPlusAdd = f32(args.flatDamage ?? 0);

    let selfDmgCutAdd: 0 = 0;

    if (svt.collectionNo === 1 /* Mash */) {
        servantAtk = f32((args.level ? svt.atkGrowth[args.level - 1] : svt.atkGrowth[79]) + args.fou + args.ce);
    }
    if (svt.collectionNo === 1 /* Mash */) {
        servantAtk = f32((args.level ? svt.atkGrowth[args.level - 1] : svt.atkGrowth[79]) + args.fou + args.ce);
    }
    if (enemyClass === "ruler" && svt.collectionNo === 167 /* Alter-ego Kiara */) {
        triangleModifier = f32(args.classOverride ?? classRelation[svt.className]["assassin"] / f32(1000));
    }

    servantAtk = f32(args.totalAttack ?? servantAtk + args.fou + (args.ce ?? 0) + (faceCard && !args.extra ? args.fouPaw ?? 0 : 0));

    let cardDamageValue = 1;

    /** Card hit damage distribution */
    let hits = (noblePhantasm as NoblePhantasm.NoblePhantasm).npDistribution ?? [];

    if (faceCard) {
        if (args.arts) {
            cardDamageValue = 1;
            hits = svt.hitsDistribution.arts ?? [];
        } else if (args.buster) {
            cardDamageValue = 1.5;
            hits = svt.hitsDistribution.buster ?? [];
        } else if (args.quick) {
            cardDamageValue = 0.8;
            hits = svt.hitsDistribution.quick ?? [];
        } else if (args.extra) {
            cardDamageValue = 1;
            hits = svt.hitsDistribution.extra ?? [];
        }
    } else if (enemyFaceCard) {
        if (args.weak) {
            hits = svt.hitsDistribution.weak ?? [];
        } else if (args.strength && isEnemy(svt)) {
            hits = svt.hitsDistribution.strength ?? [];
        }
    }
    // No need for else because default value of hits is npDistribution
    else {
        switch ((noblePhantasm as NoblePhantasm.NoblePhantasm).card) {
            case "buster":
                cardDamageValue = 1.5;
                break;
            case "arts":
                cardDamageValue = 1;
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
    if (
        faceCard &&
        ((args.buster && !(args.second || args.third || args.extra || args.weak || args.strength)) || args.busterFirst || args.busterChain)
    ) {
        //Removed `|| (!faceCard && noblePhantasm.card === "buster")` because bf only applies for facecards
        busterFirst = true;
        firstCardBonus = f32(0.5);
    }
    if (faceCard && ((args.quick && !(args.second || args.third || args.extra || args.weak || args.strength)) || args.quickFirst)) {
        //Removed `|| (!faceCard && noblePhantasm.card === "quick")` because bf only applies for facecards
        quickFirst = true;
    }
    if (args.noBusterFirst) {
        busterFirst = false;
    }

    if (faceCard && !args.extra) {
        let tmpCardValue = cardDamageValue;
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
    if (busterFirst && faceCard) {
        firstCardBonus = 0.5;
    }
    if (args.busterChain && args.extra) extraCardModifier = 3.5;

    extraCardModifier = (args.extraCardModifier as 1 | 2 | 3.5) ?? extraCardModifier;

    if (firstCardBonus === 0.5 && args.noBusterFirst) firstCardBonus = 0;

    firstCardBonus = faceCard ? firstCardBonus : 0;

    npDamageMultiplier = faceCard || enemyFaceCard ? 1 : npDamageMultiplier;

    //--- Setting card display name
    let cardName: "NP" | "Arts" | "Buster" | "Quick" | "Extra" | "Weak" | "Strength" = "NP";
    if (args.arts) cardName = "Arts";
    if (args.buster) cardName = "Buster";
    if (args.quick) cardName = "Quick";
    if (args.extra) cardName = "Extra";
    if (args.weak) cardName = "Weak";
    if (args.strength) cardName = "Strength";

    //--- Refund terms
    let offensiveNPRate = f32(
        (noblePhantasm as NoblePhantasm.NoblePhantasm).npGain?.[cardName.toLowerCase() as keyof NoblePhantasmGain]?.[args.npLevel - 1] ?? 0
    );
    let npChargeRateMod = f32(args.npGain ?? 0) / f32(100);
    let cardNPValue;

    //--- Stargen terms
    let enemyStarDropMod: 0 = 0;
    let baseStarRate = f32(svt.starGen / 1000);

    let cardStarValue: number;

    //--- Setting up stargen terms

    cardStarValue = f32(
        (faceCard && args.quick) || (!faceCard && (noblePhantasm as NoblePhantasm.NoblePhantasm).card === "quick") ? 0.8 : 0
    );
    cardStarValue = f32(
        (faceCard && args.buster) || (!faceCard && (noblePhantasm as NoblePhantasm.NoblePhantasm).card === "buster") ? 0.1 : cardStarValue
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
    let passiveSkills = getPassivesFromServant(svt);

    if (args.quick || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "quick" && !faceCard)) {
        critDamageMod += f32(passiveSkills.quickCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.quickMod ?? 0) / f32(100);
    } else if (args.arts || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "arts" && !faceCard)) {
        critDamageMod += f32(passiveSkills.artsCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.artsMod ?? 0) / f32(100);
    } else if (args.buster || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "buster" && !faceCard)) {
        critDamageMod += f32(passiveSkills.busterCritDamageMod ?? 0) / f32(100);
        cardMod += f32(passiveSkills.busterMod ?? 0) / f32(100);
    }

    dmgPlusAdd += f32(passiveSkills.flatDamage ?? 0);
    npChargeRateMod += f32(passiveSkills.npGain ?? 0) / f32(100);

    if ((svt.collectionNo === 307 && args.arts) || svt.collectionNo !== 307 /* Crane arts sg passive | Non-crane general sg passives */) {
        starDropMod += f32(passiveSkills.starGen ?? 0) / f32(100);
    }

    npDamageMod += f32(passiveSkills.npMod ?? 0) / f32(100);

    if (args.arts) critDamageMod += f32(args.artsCritDamageMod ?? 0) / f32(100);
    if (args.buster) critDamageMod += f32(args.busterCritDamageMod ?? 0) / f32(100);
    if (args.quick) critDamageMod += f32(args.quickCritDamageMod ?? 0) / f32(100);

    if (args.arts || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "arts" && !faceCard)) {
        cardMod += f32(args.artsMod ?? 0) / f32(100);
        cardPower += f32(args.artsCardPower ?? 0) / f32(100);
    }
    if (args.buster || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "buster" && !faceCard)) {
        cardMod += f32(args.busterMod ?? 0) / f32(100);
        cardPower += f32(args.busterCardPower ?? 0) / f32(100);
    }
    if (args.quick || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "quick" && !faceCard)) {
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
        if (args.buster || ((noblePhantasm as NoblePhantasm.NoblePhantasm).card === "buster" && !faceCard)) cardMod += 0.1;

        npDamageMod += 0.1;
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

    //--- Setting up refund terms
    switch ((cardName === "NP" ? (noblePhantasm as NoblePhantasm.NoblePhantasm).card ?? "" : cardName).toLowerCase()) {
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
        warnMessage += "Value for critDamageMod exceeds cap (500%), setting to 400%.\n";
        critDamageMod = f32(5);
    }
    if (npDamageMod > 5) {
        warnMessage += "Value for npDamageMod exceeds cap (500%), setting to 400%.\n";
        npDamageMod = f32(5);
    }
    if (npChargeRateMod > 4) {
        warnMessage += "Value for npChargeRateMod exceeds cap (400%), setting to 400%.\n";
        npChargeRateMod = f32(4);
    }
    if (starDropMod > 4) {
        warnMessage += "Value for starDropMod exceeds cap (400%), setting to 400%.\n";
        starDropMod = f32(4);
    }

    //--- Misc
    let verbosity: "nv" | "" | "v" | "vv" | "vvv" = args.nonVerbose ? "nv" : ("v".repeat(args.verboseLevel ?? 0) as any);

    let cardPosition: "first" | "second" | "third" | "extra" | "none" = "none";

    if (args.first || !(args.second || args.third || args.extra || args.weak || args.strength)) cardPosition = "first";
    else if (args.second) cardPosition = "second";
    else if (args.third) cardPosition = "third";
    else if (args.extra) cardPosition = "extra";

    if (isEnemy(svt) || (!isEnemy(svt) && !faceCard)) cardPosition = "none";

    /**
     * Object describing the various terms in the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula
     * (as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
     * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas, if applicable)
     * in addition to some internals
     */
    let calcTerms: CalcTerms = {
        //--- Damage
        servantAtk,
        npDamageMultiplier,
        firstCardBonus,
        cardDamageValue,
        cardMod,
        cardPower: f32(cardPower ?? 0) / f32(100),
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
        cardNPValue,
        enemyServerMod,
        npChargeRateMod,
        overkillModifier: 1.5,
        flatRefund: f32(args.flatRefund ?? 0),

        //--- Stargen
        baseStarRate,
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
        cardName: cardName === "NP" ? (noblePhantasm?.card as any as typeof cardName) ?? "NP" : cardName,
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
        warnMessage,
        verbosity,
        fou: args.fou,
        fouPaw: args.fouPaw ?? 0,
        level: args.level,
        npLevel: args.npLevel,
        strengthen: !!+npNumber,
        ce: args.ce,
        servantURL: `https://apps.atlasacademy.io/db/JP/${isEnemy(svt) ? "enemy" : "servant"}/${svt.id}`,
        servantThumbnail:
            svt.extraAssets.faces.ascension?.[4] ??
            svt.extraAssets.faces.ascension?.[3] ??
            svt.extraAssets.faces.ascension?.[2] ??
            svt.extraAssets.faces.ascension?.[1] ??
            "",
        calcString: args.calcString ?? "",
    };

    return calcTerms;
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
    } = calcTerms;

    let NPRegen = 0,
        overkillNo = 0,
        reducedHp = argReducedHp,
        isOverkill = false;

    let npPerHit: number[] = [],
        damagePerHit: number[] = [],
        remHPPerHit: number[] = [];

    let baseNPGain = 0;

    let currEnemyHP = enemyHp! - reducedHp;

    let thisCardDamage = 0;

    for (let hitNo = 0; hitNo < hits.length; hitNo++) {
        let hit = hits[hitNo],
            thisHitDamage = Math.floor(f32((f32(damage) * f32(hit)) / f32(100)));

        if (hitNo === hits.length - 1) {
            thisHitDamage = damage - thisCardDamage;
        }

        reducedHp += thisHitDamage;
        isOverkill = reducedHp >= currEnemyHP;
        overkillNo += +isOverkill;

        baseNPGain = Math.floor(
            f32(
                f32(offensiveNPRate) *
                    f32(f32(+(artsFirst && faceCard)) + f32(f32(cardNPValue) * f32(Math.max(1 + cardMod, 0)))) *
                    f32(enemyServerMod) *
                    f32(Math.max(1 + npChargeRateMod, 0)) *
                    criticalModifier
            )
        );

        let thisHitRegen = Math.max(Math.floor(f32(baseNPGain) * f32((isOverkill && overkillModifier) || 1)) / 100, 0);

        npPerHit.push(thisHitRegen);
        damagePerHit.push(Math.floor(thisHitDamage));
        remHPPerHit.push(currEnemyHP - reducedHp);

        NPRegen += thisHitRegen;

        thisCardDamage += thisHitDamage;
    }

    NPRegen += flatRefund;

    let minNPFields = {
        offensiveNPRate,
        artsFirst,
        cardNPValue,
        cardMod,
        enemyServerMod,
        npChargeRateMod,
        isCritical,
        isOverkill,
        NPRegen,
        reducedHp,
        currEnemyHP,
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
        quickFirst,
        faceCard,
        cardStarValue,
        cardMod,
        serverRate,
        starDropMod,
        enemyStarDropMod,
        isCritical,
        flatStars,
    } = calcTerms;

    let reducedHp = argReducedHp,
        isOverkill = false,
        minStars = 0,
        maxStars = 0;

    let overkillNo = 0;

    let dropChancePerHit: number[] = [];

    let thisCardDamage = 0;

    for (let hitNo = 0; hitNo < hits.length; hitNo++) {
        let hit = hits[hitNo],
            thisHitDamage = Math.floor(f32((damage * f32(hit)) / f32(100)));

        if (hitNo === hits.length - 1) {
            thisHitDamage = damage - thisCardDamage;
        }

        reducedHp += thisHitDamage;
        isOverkill = reducedHp > enemyHp!;
        overkillNo += +isOverkill;

        let dropChance = Math.min(
            f32(
                f32(baseStarRate) +
                    f32(quickFirst && faceCard ? f32(0.2) : f32(0)) +
                    f32(f32(cardStarValue) * f32(Math.max(f32(1) + f32(cardMod), 0))) +
                    f32(serverRate) +
                    f32(starDropMod) +
                    f32(enemyStarDropMod) +
                    f32(f32(0.2) * +isCritical) +
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

    let avgStars = Math.floor(f32((minStars + maxStars) / 2));

    let starFields: StarFields = {
        baseStarRate,
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

        enemyHp,
        hits,
        fou,
        fouPaw,
        ce,
        servantClass,
        servantName,
        servantThumbnail,
        servantURL,
        warnMessage,
        verbosity,
    } = calcTerms;

    let damage = 0;
    let minrollDamage = 0;
    let maxrollDamage = 0;

    /** Base multiplicative damage */
    const rawDamage = f32(
        f32(servantAtk) *
            f32(npDamageMultiplier) *
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

    const damageAdd = f32(f32(dmgPlusAdd) + f32(selfDmgCutAdd) + f32(servantAtk * f32(busterChainMod * +faceCard)));

    // Distributing the damage after flooring (???)
    const total = Math.floor(f32(rawDamage + damageAdd));

    for (const hit of hits.slice(0, hits.length - 1)) {
        damage += f32(f32(total) * f32(f32(f32(hit) / f32(100)))); //add until second-to-last, then add the difference
    }

    damage += f32(f32(total) - f32(damage));
    damage = Math.floor(f32(Math.max(f32(damage), 0)));

    minrollDamage = Math.floor(f32(Math.max(f32(0.9) * f32(rawDamage) + f32(damageAdd), 0)));
    maxrollDamage = Math.floor(f32(Math.max(f32(1.099) * f32(rawDamage) + f32(damageAdd), 0)));

    let generalFields = {
        baseAtk: servantAtk - fou - ce - fouPaw,
        damageMultiplier: faceCard || enemyFaceCard ? cardDamageValue : npDamageMultiplier,
        servantClass,
        servantName,
        servantThumbnail,
        servantURL,
        verbosity,
        warnMessage,
    };

    let damageFields: DamageFields = {
        damage,
        minrollDamage,
        maxrollDamage,
    };

    let hasRefundOrStars = enemyHp === undefined ? false : true;

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

    return {
        calcTerms,
        generalFields,
        damageFields,
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

/** Initialise: set latest NA Servant collectionNo */
const init = (NPs: NoblePhantasm.NoblePhantasm[]) => {
    NANoblePhantasms = NPs;
};

export { calc, init };
