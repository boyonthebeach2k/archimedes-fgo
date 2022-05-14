import { Enemy, Servant } from "@atlasacademy/api-connector";
import { commands } from "./command-object";
import { calcSvt, init } from "./test";

/**
 * Maps the {@link commands} to a human-readable description containing type, aliases, etc
 * @returns
 */
const cmdArgs = () => {
    const args: { name: string; description: string; type: string }[] = [];

    for (const [commandName, command] of Object.entries(commands)) {
        const name = commandName,
            { aliases, param, description, type } = command;

        let aliasesDesc = aliases.length ? `Aliases: ${aliases}\n` : "",
            desc = description ?? "";

        let paramDesc = "";

        switch (param) {
            case "number":
                paramDesc = "Latest specified value overrides previous values\n";
                break;
            case "boolean":
                paramDesc = "Switch\n";
                break;
            case "number[]":
                paramDesc = "Stackable values\n";
                break;
            case "verbosity":
                paramDesc = "Toggle output verbose level\n";
                break;
        }

        const cmdDesc = (aliasesDesc + paramDesc + desc).trim();

        if (cmdDesc.length) {
            args.push({ name, description: cmdDesc, type: type ?? "Misc" });
        }
    }

    return args;
};

/**
 * Get the NP card and multiplier information for the given servant or enemy
 * @param svt The servant or enenmy whose noble phantsasms to get
 * @returns Object containing a array of the NP multipliers and cards
 */
const getNps = (svt: Servant.Servant | Enemy.Enemy) => {
    const npDesc = svt.noblePhantasms.map((np) => {
        const npMultis: string[] = [];

        for (const npFn in np.functions) {
            if (np.functions[npFn].funcType.includes("damageNp")) {
                np.functions[npFn].svals.forEach((f) => npMultis.push(+(f.Value ?? 0 / 10) + "%"));
                break;
            }
        }

        return { card: np.card, npMultis };
    });
    return npDesc;
};

export { calcSvt, cmdArgs, getNps, init };
