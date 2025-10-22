import { Enemy, Servant } from "@atlasacademy/api-connector";

import { commands } from "../commands/command-object";
import { CommandObject } from "../commands/interfaces/command-object.interfaces";

/**
 *
 * @param {RegExpMatchArray[]} regExpMatchArray[] Array of raw matches from {@link String.prototype.matchAll}
 * @returns {string[][]} For each array in the input array, leading and trailing whitespaces of each match are trimmed and resulting empty strings, if any, are removed
 */
const getSanitisedRawMatches = (regExpMatchArray: RegExpMatchArray[]): string[][] =>
    regExpMatchArray.map((matchArray) =>
        matchArray.map((untrimmedMatch) => untrimmedMatch.trim()).filter((trimmedMatch) => trimmedMatch.length)
    );

/**
 * Parses the input command string into a {@link CommandObject} object.
 * @param {string} commandString The command string containing the buffs to be parsed
 * @returns {Partial<CommandObject>} The resultant object containing various buff values and switches
 */
const parseBaseCommandString = (commandString: string): Partial<CommandObject> => {
    let matchObject: Partial<CommandObject> = {};
    const calcStr = commandString;

    // To avoid confusing, say `a10` with `a 1` (10% ATK up vs first arts card), the keys are sorted first
    (Object.keys(commands) as (keyof CommandObject)[])
        .sort((keyA, keyB) => ((commands[keyA].param ?? "") < (commands[keyB].param ?? "") ? -1 : 1))
        .forEach((cmd) => {
            const fullCmd = "(" + [cmd, ...(commands[cmd]?.aliases ?? [])].join("|") + ")";
            const booleanRegex = new RegExp(`(?<=^|\\s+)${fullCmd}(?=\\s+|$)`, "gi"),
                numbersMultipleRegex = new RegExp(`(?<=^|\\s+)${fullCmd}\\s*(-?\\d+\\.?\\d*)`, "gi"),
                numberRegex = new RegExp(`(?<=^|\\s+)${fullCmd}\\s*(-?\\d+\\.?\\d*)`, "gi"),
                verbosityRegex = new RegExp(`(?<=^|\\s+)${fullCmd}+(?=\\s+|$)`, "gi");

            if (cmd === "npMod") {
                const npDamageUpRegex = new RegExp(`(?<=^|\\s+)${fullCmd}\\s*(\\d+\\.?\\d*)`, "gi"),
                    npDamageDownRegex = new RegExp(`(?<=^|\\s+)${fullCmd}\\s*(-\\d+\\.?\\d*)`, "gi");

                const npDamageUpMatches: Partial<CommandObject> = getSanitisedRawMatches([
                    ...commandString.matchAll(npDamageUpRegex),
                ]).reduce((acc, curr) => ({ npMod: +curr[2] + ((acc[cmd] as number) ?? 0) }), {} as Partial<CommandObject>);

                const npDamageDownMatches: Partial<CommandObject> = getSanitisedRawMatches([
                    ...commandString.matchAll(npDamageDownRegex),
                ]).reduce((acc, curr) => ({ npModDown: +curr[2] + ((acc[cmd] as number) ?? 0) }), {} as Partial<CommandObject>);

                matchObject = { ...matchObject, ...npDamageUpMatches, ...npDamageDownMatches };

                commandString = commandString.replace(numbersMultipleRegex, ""); // This regex matches both the above indivdual regeces
            } else {
                switch (commands[cmd as keyof CommandObject]?.param) {
                    case "number":
                        {
                            const lastSanitisedMatch = getSanitisedRawMatches([...commandString.matchAll(numberRegex)]).reverse()[0];
                            if (!lastSanitisedMatch?.length) return;
                            matchObject = { ...matchObject, [cmd]: +lastSanitisedMatch[2] };
                            commandString = commandString.replace(numberRegex, "");
                        }
                        break;

                    case "number[]":
                        {
                            const matches: Partial<CommandObject> = getSanitisedRawMatches([
                                ...commandString.matchAll(numbersMultipleRegex),
                            ]).reduce((acc, curr) => ({ [cmd]: +curr[2] + ((acc[cmd] as number) ?? 0) }), {} as Partial<CommandObject>);
                            matchObject = { ...matchObject, ...matches };
                            commandString = commandString.replace(numbersMultipleRegex, "");
                        }
                        break;

                    case "verbosity":
                        {
                            const verboseLevel =
                                [...commandString.matchAll(verbosityRegex)].reverse().map((matchArray) => matchArray[0].trim())[0]
                                    ?.length ?? 0;
                            matchObject = { ...matchObject, ...(verboseLevel ? { verboseLevel } : {}) };
                            commandString = commandString.replace(verbosityRegex, "");
                        }
                        break;

                    case "boolean":
                        if (cmd === "verboseLevel") {
                            break;
                        }
                        {
                            const booleanMatch = [...commandString.matchAll(booleanRegex)]
                                .reverse()
                                .map((matchArray) => matchArray[0].trim())
                                .filter((str) => str.length > 0)[0];
                            if (typeof booleanMatch !== "undefined") {
                                matchObject = { ...matchObject, [cmd]: true };
                                commandString = commandString.replace(booleanRegex, "");
                            }
                        }
                        break;

                    default:
                        break;
                }
            }
        });

    commandString = commandString.trim();

    if (commandString.length) {
        if (matchObject.unknownArgs?.length) {
            matchObject.unknownArgs.concat(commandString.split(" ").filter((str) => str.length));
        } else {
            matchObject.unknownArgs = commandString.split(" ").filter((str) => str.length);
        }
    }

    matchObject.calcString = calcStr;

    return matchObject;
};

/**
 * Parses the input chain command string into an object describing the corresponding command strings per card
 * @param svt The svt whose chain is to be parsed; af/bf/qf from 1st card NP cannot be set without this information
 * @param {string} argStr The chain command string to be parsed
 * @returns Object containing the corresponding command strings per card
 */
const parseChainCommandString = (svt: Servant.Servant | Enemy.Enemy, argStr: string) => {
    argStr = argStr.toLowerCase(); // Maybe fix?

    const cards = argStr.match(/([abqx]|(np)){3}/gi)?.[0]?.split(/(?=a)|(?=b)|(?=q)|(?=x)|(?=np)/i) ?? [];

    let firstCard = "",
        artsChain = false,
        busterChain = false,
        quickChain = false,
        chain: {
            command: string;
            name: "arts" | "buster" | "quick" | "extra" | "skip" | "";
            faceCard: boolean;
            position: "first" | "second" | "third" | "";
        }[] = Array(3)
            .fill("")
            .map(() => ({ command: "", name: "", faceCard: true, position: "" }));

    const npCardName = svt.noblePhantasms[0].card;
    const cardNameMap: Record<string, string> = {
        "1": "arts",
        "2": "buster",
        "3": "quick",
    };

    for (const [cardNo, card] of cards.entries()) {
        if (card === "np") {
            chain[cardNo].faceCard = false;
            chain[cardNo].name = cardNameMap[npCardName] as (typeof chain)[0]["name"];
        } else {
            switch (cards[cardNo]) {
                case "b":
                    chain[cardNo].name = "buster";
                    break;
                case "q":
                    chain[cardNo].name = "quick";
                    break;
                case "a":
                    chain[cardNo].name = "arts";
                    break;
                case "x":
                    chain[cardNo].name = "skip";
                    break;
                default:
                    break;
            }

            switch (cardNo) {
                case 0:
                    chain[cardNo].position = "first";
                    break;
                case 1:
                    chain[cardNo].position = "second";
                    break;
                case 2:
                    chain[cardNo].position = "third";
                    break;
            }
        }
    }
    /**
     * Hardcoding af|bf|qf for Astarte, Emiya, Melusine and Ptolemy based on NP type if first card is NP and snp is present in the calc
     */
    if ([11, 268, 312].includes(svt.collectionNo) && !chain[0].faceCard) {
        const snp: "0" | "1" | "2" | undefined = argStr.match(/(?<=snp|setnp)\d+/g)?.[0] as "0" | "1" | "2" | undefined;
        const str: "0" | "1" | "2" | undefined = argStr.match(/(?<=str)[01]/g)?.[0] as "0" | "1" | undefined;

        switch (svt.collectionNo) {
            case 11: //Emiya
                // There are 4 NPs, the former two being buster and the latter two arts
                if (snp && +snp === +snp) {
                    if (+snp / 2 < 1) {
                        chain[0].name = "buster";
                    } else {
                        chain[0].name = "arts";
                    }
                }
                if (str && +str === +str) {
                    switch (str) {
                        case "0":
                            chain[0].name = "buster";
                            break;
                        case "1":
                            chain[0].name = "arts";
                            break;
                    }
                }
                break;

            case 268: // Astarte
                // There are 3 NPs - arts, buster and quick respectively
                if (snp && +snp === +snp) {
                    switch (snp) {
                        case "0":
                            chain[0].name = "arts";
                            break;
                        case "1":
                            chain[0].name = "buster";
                            break;
                        case "2":
                            chain[0].name = "quick";
                            break;
                    }
                }
                if (str && +str === +str) {
                    switch (str) {
                        case "0":
                            chain[0].name = "arts";
                            break;
                        case "1":
                            chain[0].name = "quick";
                            break;
                    }
                }
                break;

            case 312: // Melusine
                // There are 2 NPs - buster and arts respectively
                if (snp && +snp === +snp) {
                    switch (snp) {
                        case "0":
                            chain[0].name = "arts";
                            break;
                        case "1":
                            chain[0].name = "buster";
                            break;
                    }
                }
                if (str && +str === +str) {
                    switch (str) {
                        case "0":
                            chain[0].name = "arts";
                            break;
                        case "1":
                            chain[0].name = "buster";
                            break;
                    }
                }
                break;
            case 394: // Ptolemy
                // There are 2 NPs, the former being buster and the latter arts
                if (snp && +snp === +snp) {
                    switch (str) {
                        case "0":
                            chain[0].name = "buster";
                            break;
                        case "1":
                            chain[0].name = "arts";
                            break;
                    }
                }
                if (str && +str === +str) {
                    switch (str) {
                        case "0":
                            chain[0].name = "buster";
                            break;
                        case "1":
                            chain[0].name = "arts";
                            break;
                    }
                }
                break;
        }
    }

    if (chain[0].name === "arts") firstCard += "af ";
    else if (chain[0].name === "buster") firstCard += "bf ";
    else if (chain[0].name === "quick") firstCard += "qf ";

    if (chain.every((val, _, a) => val.name === a[0].name && val.name === "arts")) artsChain = true;
    if (chain.every((val, _, a) => val.name === a[0].name && val.name === "buster")) busterChain = true;
    if (chain.every((val, _, a) => val.name === a[0].name && val.name === "quick")) quickChain = true;

    if ((["arts", "buster", "quick"] as const).every((cardName) => chain.map((card) => card.name).includes(cardName))) {
        firstCard += " mightychain ";
    }

    chain = [
        ...chain,
        ...(cards.includes("x") || svt.type === "enemy"
            ? []
            : [{ command: "", name: "extra" as const, faceCard: true, position: "" as const }]),
    ];

    argStr = firstCard + argStr;

    // eslint-disable-next-line prefer-const
    let [baseStr, ...commands] = argStr.split("card").map((str) => str.trim());

    baseStr = baseStr.replace(/([abqx]|(np)){3}/gi, "").trim();

    commands.forEach((command) => {
        const cardNo = +command[0] - 1;
        command = command.slice(1).trim();
        chain[cardNo].command += command.length ? command + " " : "";
    });

    chain.forEach((card) => {
        if (card.faceCard && card.name !== "skip") {
            card.command += `${card.name} ${card.position} `;
        }
    });

    if (chain[0].name === chain[1].name && chain[1].name === chain[2].name && chain[3] !== undefined) {
        chain[3].command = "ecm 3.5 " + chain[3].command;
    }

    let hasRefundOrStars = false,
        enemyHp: number | undefined;

    const hpMatches = baseStr.match(/(^|\s+)hp\s*\d+/g);

    if (hpMatches !== null) {
        hasRefundOrStars = true;
        enemyHp = +hpMatches?.[0]?.replace(/\D+/g, "") ?? [];
        baseStr = baseStr.replace(/\s+hp\s*\d+/g, "");
    }

    const chainCommands = chain.map((card) => ({ command: card.command, faceCard: card.faceCard, name: card.name }));

    let npPresent = false;

    for (const chainCommand of chainCommands) {
        if (npPresent && svt.collectionNo === 351 /** ARCHETYPE-Earth */) {
            chainCommand.command += " m30"; // Any card following NP gets 30% cardmod
        }

        if (!chainCommand.faceCard) {
            /** NP is present; setting after m30 logic to ensure cards that follow NP get the cardmod, as {@link commandObjectToCalcTerms NP for 351 already gets m30} */
            npPresent = true;
        }
    }

    return { cards: chainCommands, baseStr, hasRefundOrStars, enemyHp, artsChain, busterChain, quickChain };
};

/**
 * Parses the input multi-enemy command string into an object describing the corresponding command strings per card
 * @param {string} cmdStr The command string to be parsed
 * @returns Object containing the corresponding command strings per wave
 */
const parseMultiEnemyCommandString = (cmdStr: string) => {
    const baseStr: string = cmdStr.split("[")[0],
        waveCmds: string[] = [...(cmdStr.match(/\[[\s\S]*?\](\s*\*\s*\d+)?/gi) ?? [])],
        waves: { enemies: string[] }[] = [],
        verboseLevel =
            (cmdStr.match(/(\s+|^)nv+(\s+|$)/) ?? [""])[0].trim() === "nv"
                ? -1
                : (cmdStr.match(/(\s+|^)v+(\s+|$)/) || [""])[0].trim().length;

    for (const waveCmd of waveCmds) {
        const enemies: string[] = [];
        let cmd = waveCmd;
        let npCmd = "";

        const waveRepeats = +(((cmd.match(/\*\s*\d+$/) ?? [])[0] ?? "")[(cmd.match(/\*\s*\d+$/) ?? [""])[0]?.length - 1] ?? 1);

        cmd = cmd.replace(/\*\s*\d+$/, "").trim();
        cmd = cmd.replace(/^\[|\]$/gi, "").trim();

        let enemyCmds = cmd.split(",");
        let waveNPPosition: number;
        let waveBuffs: string;

        for (let i = 0; i < enemyCmds.length; i++) {
            let enemy = enemyCmds[i];

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-non-null-asserted-optional-chain
            const enemyRepeat = +(((enemy.match(/\*\s*\d+$/) ?? [])[0] ?? "")[(enemy.match(/\*\s*\d+$/) ?? [])[0]?.length! - 1] ?? 1);
            enemy = enemy.replace(/\*\s*\d+$/, "").trim();

            const chain = (enemy.match(/([abqx]|(np)){3}/gi) && enemy.split(",")[0]) ?? "";
            const chainCards = (enemy.match(/([abqx]|(np)){3}/gi) ?? [""])[0].toLowerCase();

            //--- Getting the position of NP card (if any) in the chain and then getting buffs for that card only

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            waveNPPosition = waveNPPosition! || (chainCards !== "npnpnp" ? chainCards.indexOf("np") : -1) + 1;

            npCmd = npCmd || (chain.split(new RegExp(`card\\s*${waveNPPosition}`))[1]?.split("card")?.[0] ?? "");

            //--- Removing the chain arguments since they are applied automatically
            enemy = enemy.replace(/([abqx]|(np)){3}/gi, "")?.split("card")?.[0] ?? "";

            //--- Isolating wave-wide buffs
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (!waveBuffs!) {
                waveBuffs = i === 0 && enemy.includes(":") ? enemy.split(":")[0] : "";
            }

            enemy = waveBuffs + " " + (enemy.split(":").length > 1 ? enemy.split(":").slice(1).join("") : enemy);

            enemyCmds[i] = Array(chainCards !== "npnpnp" ? enemyRepeat : 1).fill(enemy.replace(/\s+/g, " ").trim()) as unknown as string;

            (enemyCmds as unknown as string[][])[i][0] = (chain !== "" ? chain : enemy)
                .replace(npCmd, " ")
                .replace(/card\s*\d\s+(?=card)/gi, "")
                .trim();
        }

        enemyCmds = enemyCmds.flat();

        enemyCmds.forEach((enemyCmd) => {
            enemies.push(
                (enemyCmd + " " + (enemyCmd.match(/([abqx]|(np)){3}/gi) ? `card ${waveNPPosition}` : "") + npCmd)
                    .replace(/card\s*0/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
            );
        });

        for (let i = 0; i < waveRepeats; i++) {
            waves.push({ enemies });
        }
    }

    return { baseStr, waves, verboseLevel };
};

export { parseBaseCommandString, parseChainCommandString, parseMultiEnemyCommandString };
