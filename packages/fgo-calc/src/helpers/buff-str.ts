import { Buff, Card } from "@atlasacademy/api-connector";

const { BuffType: bt } = Buff;

const buffTypeToBuffStr = (buffType: Buff.BuffType, value: number, cardType?: Card) => {
    if (buffType === bt.UP_COMMANDATK) {
        return `${(cardType ?? "")[0].toLowerCase()}cp${value / 10}`;
    }
    if (buffType === bt.DOWN_COMMANDATK) {
        return `${(cardType ?? "")[0].toLowerCase()}cp-${value / 10}`;
    }
    if (buffType === bt.UP_COMMANDNP) {
        return "";
    }
    if (buffType === bt.DOWN_COMMANDNP) {
        return "";
    }
    if (buffType === bt.UP_COMMANDSTAR) {
        return "";
    }
    if (buffType === bt.DOWN_COMMANSTAR) {
        return "";
    }
    if (buffType === bt.UP_COMMANDALL) {
        return `${(cardType ?? "")[0].toLowerCase()}m${value / 10}`;
    }
    if (buffType === bt.DOWN_COMMANDALL) {
        return `${(cardType ?? "")[0].toLowerCase()}m-${value / 10}`;
    }
    if (buffType === bt.UP_CRITICALDAMAGE) {
        return `${(cardType ?? "")[0].toLowerCase()}cd${value / 10}`;
    }
    if (buffType === bt.DOWN_CRITICALDAMAGE) {
        return `${(cardType ?? "")[0].toLowerCase()}cd-${value / 10}`;
    }

    return (
        (
            {
                [bt.UP_ATK]: `a${value / 10}`,
                [bt.DOWN_ATK]: `a-${value / 10}`,
                [bt.UP_CRITICALPOINT]: `sg${value / 10}`,
                [bt.DOWN_CRITICALPOINT]: `sg-${value / 10}`,
                [bt.UP_DAMAGE]: `p${value / 10}`,
                [bt.DOWN_DAMAGE]: `p-${value / 10}`,
                [bt.ADD_DAMAGE]: `fd${value}`,
                [bt.SUB_DAMAGE]: `fd-${value}`,
                [bt.UP_NPDAMAGE]: `n${value / 10}`,
                [bt.DOWN_NPDAMAGE]: `n-${value / 10}`,
                [bt.UP_DROPNP]: `ng${value / 10}`,
                [bt.DOWN_DROPNP]: `ng-${value / 10}`,
                [bt.UP_DEFENCE]: `d${value / 10}`,
                [bt.DOWN_DEFENCE]: `d-${value / 10}`,
                [bt.UP_SPECIALDEFENCE]: `sdm${value / 10}`,
                [bt.DOWN_SPECIALDEFENCE]: `sdm-${value / 10}`,
                [bt.UP_DAMAGE_SPECIAL]: `sam${value / 10}`,
            } as Partial<typeof bt>
        )[buffType as unknown as keyof Partial<typeof bt>] ?? ""
    );
};

export default buffTypeToBuffStr;
