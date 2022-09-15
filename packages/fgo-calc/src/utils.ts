import { Func, Buff } from "@atlasacademy/api-connector";

const f = Math.fround;

const offensiveBuffToCalcStr = (buffType: string, value: number, card: "" | "a" | "b" | "q" | "e" = "") =>
    ({
        [Buff.BuffType.UP_COMMANDATK]: `${card}cp${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_COMMANDATK]: `${card}cp-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_CRITICALPOINT]: `sg${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_CRITICALPOINT]: `sg-${(f(value) / f(10)).toFixed(2)}`,
        //[Buff.BuffType.REGAIN_NP_USED_NOBLE]: `fr${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_ATK]: `a${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_ATK]: `a-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_DAMAGE]: `p${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_DAMAGE]: `p-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.ADD_DAMAGE]: `fd${f(value).toFixed(2)}`,
        [Buff.BuffType.SUB_DAMAGE]: `fd-${f(value).toFixed(2)}`,
        [Buff.BuffType.UP_NPDAMAGE]: `n${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_NPDAMAGE]: `n-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_DROPNP]: `ng${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_DROPNP]: `ng-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_CRITICALDAMAGE]: `${card}cd${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_CRITICALDAMAGE]: `${card}cd-${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.ADD_SELFDAMAGE]: `fd${f(value).toFixed(2)}`,
        [Buff.BuffType.SUB_SELFDAMAGE]: `fd-${f(value).toFixed(2)}`,
        [Buff.BuffType.UP_COMMANDALL]: `${card}m${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.DOWN_COMMANDALL]: `${card}m${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_DAMAGE_SPECIAL]: `sam${(f(value) / f(10)).toFixed(2)}`,
        [Buff.BuffType.UP_DAMAGE_SPECIAL]: `sam${(f(value) / f(10)).toFixed(2)}`,
    }[buffType] ?? "");

const funcToCalcStr = (func: Func.Func, level = 9) => {
    const buffStrs: Partial<{ [key in Func.FuncTargetType]: string }> = {};

    for (const buff of func.buffs) {
        let card: "" | "a" | "b" | "q" | "e" = "";

        if (buff.ckSelfIndv.some((selfIndv) => [4001, 4002, 4003, 4004].includes(selfIndv.id))) {
            for (const selfIndv of buff.ckSelfIndv) {
                switch (selfIndv.id) {
                    case 4001:
                        card = "a";
                        break;
                    case 4002:
                        card = "b";
                        break;
                    case 4003:
                        card = "q";
                        break;
                    case 4004:
                        card = "e";
                        break;
                }
            }
        }

        const buffStr = offensiveBuffToCalcStr(buff.type, func.svals[level].Value ?? 0, card);

        if (buffStr) {
            buffStrs[func.funcTargetType] = buffStrs[func.funcTargetType] ? buffStrs[func.funcTargetType] + " " + buffStr : buffStr;
        }
    }

    return buffStrs;
};

export { funcToCalcStr };
