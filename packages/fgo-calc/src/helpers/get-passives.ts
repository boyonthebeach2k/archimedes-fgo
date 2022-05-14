import { Enemy, Servant } from "@atlasacademy/api-connector";

import { CommandObject } from "../commands/interfaces/command-object.interfaces";
import { parseBaseCommandString } from "./parse-args";

/** Maps the passed-in buffName & value to a command string that can then be parsed using {@link parseBaseCommandString}
 * @param buffName The buff detail in JP
 * @param value The value of the buff
 * @returns Command string which can then be parsed using {@link parseBaseCommandString}
 */
const buffToCommandString = function getPassives(buffName: keyof { [key: string]: string }, value: number) {
    let buff: string;

    switch (buffName) {
        case "宝具で与えるダメージをアップ":
            buff = `n${value / 10}`;
            break;
        case "Quickカードのクリティカル時のダメージをアップ":
            buff = `qcm${value / 10}`;
            break;
        case "Quickカードの性能をアップ":
            buff = `qm${value / 10}`;
            break;
        case "クリティカル時のダメージをアップ":
            buff = `acm${value / 10} bcm${value / 10} qcm${value / 10}`;
            break;
        case "Artsカードのクリティカル時のダメージをアップ":
            buff = `acm${value / 10}`;
            break;
        case "与えるダメージを増やす":
            buff = `fd${value}`;
            break;
        case "NP獲得量をアップ":
            buff = `ng${value / 10}`;
            break;
        case "スター発生率をアップ":
            buff = `sg${value / 10}`;
            break;
        case "Busterカードのクリティカル時のダメージをアップ":
            buff = `bcm${value / 10}`;
            break;
        case "Busterカードの性能をアップ":
            buff = `bm${value / 10}`;
            break;
        case "Artsカードの性能をアップ":
            buff = `am${value / 10}`;
            break;
        case "攻撃力をアップ":
            buff = `a${value / 10}`;
            break;
        default:
            buff = "";
            break;
    }

    return buff;
};

/**
 * Maps the passive skills of the given Servant to a CommandObject which can then be used to generate calc terms
 * @param servant The svt whose passives to get
 * @returns A {@link CommandObject} describing the various offensive passive buffs for the given Servant
 */
const getPassivesFromServant = (servant: Servant.Servant | Enemy.Enemy): Partial<CommandObject> => {
    let passiveCmdString = "";

    for (let passive of servant.classPassive) {
        for (let func of passive.functions) {
            for (let buff of func.buffs) {
                let cmdAdd = buffToCommandString(buff.detail, func.svals[0].Value ?? 0);

                passiveCmdString += cmdAdd + " ";
            }
        }
    }

    return parseBaseCommandString(passiveCmdString);
};

export { getPassivesFromServant };
