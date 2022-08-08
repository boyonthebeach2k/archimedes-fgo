import { Buff, Card } from "@atlasacademy/api-connector";

const { BuffType } = Buff;

const buffTypeToBuffStr = (buffType: Buff.BuffType, value: number, cardType?: Card) => {
    if (buffType === BuffType.UP_COMMANDATK) {
        return `${(cardType ?? " ")[0].toLowerCase()}cp${value / 10}`;
    }
    if (buffType === BuffType.DOWN_COMMANDATK) {
        return `${(cardType ?? " ")[0].toLowerCase()}cp-${value / 10}`;
    }
    if (buffType === BuffType.UP_COMMANDNP) {
        return "";
    }
    if (buffType === BuffType.DOWN_COMMANDNP) {
        return "";
    }
    if (buffType === BuffType.UP_COMMANDSTAR) {
        return "";
    }
    if (buffType === BuffType.DOWN_COMMANSTAR) {
        return "";
    }
    if (buffType === BuffType.UP_COMMANDALL) {
        return `${(cardType ?? " ")[0].toLowerCase()}m${value / 10}`;
    }
    if (buffType === BuffType.DOWN_COMMANDALL) {
        return `${(cardType ?? " ")[0].toLowerCase()}m-${value / 10}`;
    }
    if (buffType === BuffType.UP_CRITICALDAMAGE) {
        return `${(cardType ?? " ")[0].toLowerCase()}cd${value / 10}`;
    }
    if (buffType === BuffType.DOWN_CRITICALDAMAGE) {
        return `${(cardType ?? " ")[0].toLowerCase()}cd-${value / 10}`;
    }

    return (
        (
            {
                [BuffType.UP_ATK]: `a${value / 10}`,
                [BuffType.DOWN_ATK]: `a-${value / 10}`,
                [BuffType.UP_CRITICALPOINT]: `sg${value / 10}`,
                [BuffType.DOWN_CRITICALPOINT]: `sg-${value / 10}`,
                [BuffType.UP_DAMAGE]: `p${value / 10}`,
                [BuffType.DOWN_DAMAGE]: `p-${value / 10}`,
                [BuffType.ADD_DAMAGE]: `fd${value}`,
                [BuffType.SUB_DAMAGE]: `fd-${value}`,
                [BuffType.UP_NPDAMAGE]: `n${value / 10}`,
                [BuffType.DOWN_NPDAMAGE]: `n-${value / 10}`,
                [BuffType.UP_DROPNP]: `ng${value / 10}`,
                [BuffType.DOWN_DROPNP]: `ng-${value / 10}`,
                [BuffType.UP_DEFENCE]: `d${value / 10}`,
                [BuffType.DOWN_DEFENCE]: `d-${value / 10}`,
                [BuffType.UP_SPECIALDEFENCE]: `sdm${value / 10}`,
                [BuffType.DOWN_SPECIALDEFENCE]: `sdm-${value / 10}`,
                [BuffType.UP_DAMAGE_SPECIAL]: `sam${value / 10}`,
            } as Partial<typeof BuffType>
        )[buffType as unknown as keyof Partial<typeof BuffType>] ?? ""
    );
};

export default buffTypeToBuffStr;
