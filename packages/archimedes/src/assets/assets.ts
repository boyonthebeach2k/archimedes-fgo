/* eslint-disable @typescript-eslint/no-var-requires */
import { Emoji } from "discord.js";

const nicknames: { [key: string]: string[] } = require("./nicknames.json");
const emojis: { name: string; id: string; toString: () => string }[] = require("./emojis.json").map((emoji: Emoji) => ({
    name: emoji.name,
    id: emoji.id,
    toString() {
        return `<:${this.name}:${this.id}>`;
    },
}));

const emoji = (emojiName: string) => {
    const sanitisedNames = {
        beasti: "Beast_I",
        beastii: "Beast_II",
        beastiiir: "Beast_III",
        beastiiil: "Beast_III",
        ["beastiii/r"]: "Beast_III",
        ["beastiii/l"]: "Beast_III",
        beastiv: "Beast_IV",
        beastunknown: "Beast_False",
        cccfinaleemiyaalter: "BrokenArcher_Gold",
        beasteresh: "beast",
    };

    emojiName = sanitisedNames[emojiName as keyof typeof sanitisedNames] ?? emojiName;

    return emojis.find((e) => e.name === emojiName)?.toString() ?? "";
};

export { nicknames, emoji };
