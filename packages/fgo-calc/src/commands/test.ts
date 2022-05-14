import { Enemy, Servant } from "@atlasacademy/api-connector";

import { parseChainCommandString, parseMultiEnemyCommandString } from "../helpers/parse-args";
import { calc, init } from "./calc";
import { CalcVals, ChainCalcVals, EnemyCalcVals } from "./interfaces/commands.interfaces";

/**
 * Parses and calcs the given command string, applying the specific buffs to the required svt
 * @param svt The servant or enemy to calc for
 * @param argStr The command string containing the various buffs and enemy details to be parsed
 * @returns The calced results of the given command string
 */
const calcSvt = (svt: Servant.Servant | Enemy.Enemy, argStr: string) => {
    let vals: CalcVals | ChainCalcVals | EnemyCalcVals;

    let type: "card" | "chain" | "enemy";

    const cmdArgs = argStr
        .split("#")[0] // removing trailing comments from the command string
        .replace(/\/\*[\s\S]*?(\*\/)/g, "") // removing inline comments from the command string
        .replace(/\|/g, "") // removing separators
        .replace(/\s+/g, " ") // removing unwieldy whitespace
        .trim();

    if (cmdArgs.includes("[")) {
        vals = multiEnemy(svt, cmdArgs);
        type = "enemy";
    } else if (cmdArgs.match(/([abqx]|(np)){3}/g) !== null) {
        vals = chain(svt, cmdArgs);
        type = "chain";
    } else {
        vals = calc(svt, cmdArgs);
        type = "card";
    }

    return { vals, type };
};

/**
 * Obtain damage, refund, etc for each card in the given chain by calling the calc function sequentially
 * @param svt The servant whose card chain is to be calced
 * @param cmdStr The whole command string containing the various buffs
 * @returns A {@link ChainCalcVals} object containing the various results obtained after calcing the given chain
 */
const chain = (svt: Servant.Servant | Enemy.Enemy, cmdStr: string): ChainCalcVals => {
    let damageFields = {
            totalDamage: 0,
            minrollTotalDamage: 0,
            maxrollTotalDamage: 0,
        },
        refundStarFields = {
            accReducedHp: 0,
            maxAccReducedHp: 0,
            minrollTotalRefund: 0,
            maxrollTotalRefund: 0,
            minrollTotalMinStars: 0,
            minrollTotalMaxStars: 0,
            maxrollTotalMinStars: 0,
            maxrollTotalMaxStars: 0,
            minrollAvgStars: 0,
            maxrollAvgStars: 0,
            overkillNo: 0,
            maxOverkillNo: 0,
        },
        warnings = "",
        calcVals: { minrollCalcVals: CalcVals; maxrollCalcVals: CalcVals }[] = [];

    let {
        baseStr,
        cards,
        hasRefundOrStars,
        artsChain,
        busterChain,
        quickChain,
        enemyHp: minEnemyHp,
    } = parseChainCommandString(svt, cmdStr);

    let maxEnemyHp = minEnemyHp;

    if (artsChain) {
        refundStarFields.minrollTotalRefund += 20;
        refundStarFields.maxrollTotalRefund += 20;
    }

    if (busterChain) {
        baseStr += " bc";
    }

    if (quickChain) {
        refundStarFields.minrollTotalMinStars += 20;
        refundStarFields.minrollTotalMaxStars += 20;
        refundStarFields.maxrollTotalMinStars += 20;
        refundStarFields.maxrollTotalMaxStars += 20;
    }

    for (const [cardNo, card] of cards.entries()) {
        if (card.name === "skip") {
            continue;
        }

        const cardMinCmdString =
            baseStr + " " + (hasRefundOrStars ? `hp${minEnemyHp} reducedHp${refundStarFields.accReducedHp}` : "") + " " + card.command;

        const cardMaxCmdString =
            baseStr + " " + (hasRefundOrStars ? `hp${maxEnemyHp} reducedHp${refundStarFields.maxAccReducedHp}` : "") + " " + card.command;

        const minrollCalcVals = calc(svt, cardMinCmdString);
        const maxrollCalcVals = calc(svt, cardMaxCmdString);

        calcVals.push({ minrollCalcVals, maxrollCalcVals });

        warnings += minrollCalcVals.generalFields.warnMessage;

        damageFields.minrollTotalDamage += minrollCalcVals.damageFields.minrollDamage;
        damageFields.totalDamage += minrollCalcVals.damageFields.damage;
        damageFields.maxrollTotalDamage += maxrollCalcVals.damageFields.maxrollDamage;

        if (hasRefundOrStars) {
            minEnemyHp = minEnemyHp as number;
            maxEnemyHp = maxEnemyHp as number;

            if (!card.faceCard) {
                refundStarFields.minrollTotalRefund = refundStarFields.maxrollTotalRefund = 0;
                refundStarFields.overkillNo = refundStarFields.maxOverkillNo = 0;
            }

            refundStarFields.overkillNo += minrollCalcVals.minNPFields.overkillNo;
            refundStarFields.maxOverkillNo += maxrollCalcVals.maxNPFields.overkillNo;
            refundStarFields.minrollTotalRefund += minrollCalcVals.minNPFields.NPRegen;
            refundStarFields.maxrollTotalRefund += maxrollCalcVals.maxNPFields.NPRegen;

            refundStarFields.minrollTotalMinStars += minrollCalcVals.minStarFields.minStars;
            refundStarFields.minrollTotalMaxStars += minrollCalcVals.minStarFields.maxStars;
            refundStarFields.maxrollTotalMinStars += maxrollCalcVals.maxStarFields.minStars;
            refundStarFields.maxrollTotalMaxStars += maxrollCalcVals.maxStarFields.maxStars;
            refundStarFields.minrollAvgStars += minrollCalcVals.minStarFields.avgStars;
            refundStarFields.maxrollAvgStars += maxrollCalcVals.maxStarFields.avgStars;
            refundStarFields.accReducedHp = minrollCalcVals.minNPFields.reducedHp;
            refundStarFields.maxAccReducedHp = maxrollCalcVals.maxNPFields.reducedHp;

            const nextCardNP = cards[cardNo + 1]?.faceCard === false;

            if (nextCardNP) {
                minEnemyHp -= refundStarFields.accReducedHp;
                maxEnemyHp -= refundStarFields.maxAccReducedHp;
                refundStarFields.accReducedHp = 0;
                refundStarFields.maxAccReducedHp = 0;
            }
        }
    }

    return {
        cards,
        baseStr,
        calcVals,
        hasRefundOrStars,
        ...damageFields,
        ...refundStarFields,
        warnings,
    };
};

/**
 * Obtain damage, refund, etc for each given enemy by calling the calc function sequentially per enemy as well as chain where applicable
 * @param svt The servant to be calced
 * @param cmdStr The whole command string containing the various buffs
 * @returns An {@link EnemyCalcVals} object containing the various results obtained after calcing the given svt & enemies
 */
const multiEnemy = (svt: Servant.Servant | Enemy.Enemy, cmdStr: string): EnemyCalcVals => {
    const { baseStr, waves, verboseLevel } = parseMultiEnemyCommandString(cmdStr);

    const enemyCalcVals: EnemyCalcVals = {
        waves: [],
        verboseLevel,
    };

    for (const wave of waves) {
        let enemyVals: {
            calcVals: CalcVals | ChainCalcVals;
            damage: number;
            minDamage: number;
            maxDamage: number;
            hasRefundOrStars: boolean;
            minNPRegen?: number;
            maxNPRegen?: number;
            minStars?: number;
            maxStars?: number;
            enemyClass: string;
            enemyAttribute: string;
            warnings: string;
        }[] = [];
        let hasChain = false;

        let waveFields = {
            totalDamage: 0,
            minrollTotalDamage: 0,
            maxrollTotalDamage: 0,
            minrollTotalRefund: 0,
            maxrollTotalRefund: 0,
            minrollTotalStars: 0,
            maxrollTotalStars: 0,
            overkillNo: 0,
            maxOverkillNo: 0,
            warnings: "",
        };

        for (const enemyCmd of wave.enemies) {
            hasChain = !!enemyCmd.match(/([abqx]|(np)){3}/gi);

            let calcVals: CalcVals | ChainCalcVals;

            let damage, minDamage, maxDamage, minNPRegen, maxNPRegen, minStars, maxStars, overkillNo, maxOverkillNo;
            let enemyClass, enemyAttribute;
            let hasRefundOrStars = false;
            let warnings = "";

            if (hasChain) {
                calcVals = chain(svt, baseStr + enemyCmd);

                enemyClass = calcVals.calcVals[0].minrollCalcVals.calcTerms.enemyClass;
                enemyAttribute = calcVals.calcVals[0].minrollCalcVals.calcTerms.enemyAttribute;
                hasRefundOrStars = calcVals.hasRefundOrStars;

                damage = calcVals.totalDamage;
                minDamage = calcVals.minrollTotalDamage;
                maxDamage = calcVals.maxrollTotalDamage;

                if (hasRefundOrStars) {
                    minNPRegen = calcVals.minrollTotalRefund;
                    maxNPRegen = calcVals.maxrollTotalRefund;
                    minStars = calcVals.minrollTotalMinStars;
                    maxStars = calcVals.minrollTotalMaxStars;
                    overkillNo = calcVals.overkillNo;
                    maxOverkillNo = calcVals.maxOverkillNo;
                }

                warnings += (warnings.trim() ? "\n" : "") + calcVals.warnings;
            } else {
                calcVals = calc(svt, baseStr + enemyCmd);

                enemyClass = calcVals.calcTerms.enemyClass;
                enemyAttribute = calcVals.calcTerms.enemyAttribute;
                hasRefundOrStars = calcVals.calcTerms.enemyHp !== undefined;

                damage = calcVals.damageFields.damage;
                minDamage = calcVals.damageFields.minrollDamage;
                maxDamage = calcVals.damageFields.maxrollDamage;

                if (hasRefundOrStars) {
                    minNPRegen = calcVals.minNPFields.NPRegen;
                    maxNPRegen = calcVals.maxNPFields.NPRegen;
                    minStars = calcVals.minStarFields.minStars;
                    maxStars = calcVals.maxStarFields.maxStars;
                    overkillNo = calcVals.minNPFields.overkillNo;
                    maxOverkillNo = calcVals.maxNPFields.overkillNo;
                }

                warnings += (warnings.trim() ? "\n" : "") + calcVals.calcTerms.warnMessage;
            }

            waveFields.totalDamage += damage;
            waveFields.minrollTotalDamage += minDamage;
            waveFields.maxrollTotalDamage += maxDamage;
            waveFields.minrollTotalRefund += minNPRegen ?? 0;
            waveFields.maxrollTotalRefund += maxNPRegen ?? 0;
            waveFields.overkillNo += overkillNo ?? 0;
            waveFields.maxOverkillNo += maxOverkillNo ?? 0;
            waveFields.minrollTotalStars += minStars ?? 0;
            waveFields.maxrollTotalStars += maxStars ?? 0;

            enemyVals.push({
                calcVals,
                damage,
                minDamage,
                maxDamage,
                hasRefundOrStars,
                ...(hasRefundOrStars ? { minNPRegen, maxNPRegen, minStars, maxStars, overkillNo, maxOverkillNo } : {}),
                enemyClass,
                enemyAttribute,
                warnings,
            });
        }
        enemyCalcVals.waves.push({ hasChain, enemyVals, waveFields });
    }

    return enemyCalcVals;
};

export { calcSvt, init };
