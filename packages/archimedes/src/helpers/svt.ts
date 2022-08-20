/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from "fs";
import Fuse from "fuse.js";
import fetch from "node-fetch";

import {
    ApiConnector,
    CommandCode,
    Enemy,
    Entity,
    Event,
    Language,
    MysticCode,
    NoblePhantasm,
    Region,
    Servant,
    War,
} from "@atlasacademy/api-connector";

import { nicknames } from "../assets/assets";

const JPApiConnector = new ApiConnector({
    host: "https://api.atlasacademy.io",
    region: Region.JP,
    language: Language.ENGLISH,
});

const NAApiConnector = new ApiConnector({
    host: "https://api.atlasacademy.io",
    region: Region.NA,
    language: Language.ENGLISH,
});

const shouldReloadSvts = process.argv.map((arg) => arg.toLowerCase()).includes("reload-servants");

let servants: Servant.Servant[],
    bazettNP: NoblePhantasm.NoblePhantasm,
    basicNAServants: Servant.ServantBasic[],
    basicJPSvts: Entity.EntityBasic[],
    basicJPCCs: (CommandCode.CommandCodeBasic & { collectionNo: number; type: any })[],
    basicJPMCs: (MysticCode.MysticCodeBasic & { collectionNo: number; type: any })[],
    basicJPWars: (War.WarBasic & { collectionNo: number; type: any })[],
    basicJPEvents: (Event.EventBasic & { collectionNo: number; type: any })[];

let fuseServants: Fuse<Servant.Servant>,
    fuseSvts: Fuse<
        (Entity.EntityBasic | CommandCode.CommandCodeBasic | MysticCode.MysticCodeBasic | War.WarBasic | Event.EventBasic) & {
            collectionNo: number;
            type: Entity.EntityType;
        }
    >;

const downloadSvts = () =>
    Promise.all([
        JPApiConnector.servantListNice(),
        JPApiConnector.entityList(),
        JPApiConnector.commandCodeList(),
        JPApiConnector.mysticCodeList(),
        JPApiConnector.warList(),
        JPApiConnector.eventList(),
    ])
        .then(([iServants, iSvts, iCCs, iMCs, iWars, iEvents]) => {
            servants = iServants;
            basicJPSvts = iSvts;
            basicJPCCs = iCCs.map((cc) => ({ ...cc, collectionNo: 0, type: Entity.EntityType.COMMAND_CODE }));
            basicJPMCs = iMCs.map((mc) => ({ ...mc, collectionNo: 0, type: "mysticCode" as any }));
            basicJPWars = iWars.map((war) => ({ ...war, name: war.longName, collectionNo: 0, type: "war" as any }));
            basicJPEvents = iEvents.map((event) => ({ ...event, collectionNo: 0, type: "event" as any }));

            console.log("Svts fetched, writing...");

            return [
                fs.writeFile(__dirname + "/" + "../assets/nice_servants.json", JSON.stringify(iServants)),
                fs.writeFile(__dirname + "/" + "../assets/basic_svt_lang_en.json", JSON.stringify(iSvts)),
                fs.writeFile(__dirname + "/" + "../assets/basic_command_code_lang_en.json", JSON.stringify(iCCs)),
                fs.writeFile(__dirname + "/" + "../assets/basic_mystic_code_lang_en.json", JSON.stringify(iMCs)),
                fs.writeFile(__dirname + "/" + "../assets/basic_war_lang_en.json", JSON.stringify(iWars)),
                fs.writeFile(__dirname + "/" + "../assets/basic_event_lang_en.json", JSON.stringify(iEvents)),
            ];
        })
        .then((writePromises) => Promise.all(writePromises).then(() => console.log("Svts saved.")));

const loadSvts = () =>
    Promise.all([
        fs.readFile(__dirname + "/" + "../assets/nice_servants.json", { encoding: "utf8" }),
        fs.readFile(__dirname + "/" + "../assets/basic_svt_lang_en.json", { encoding: "utf8" }),
        fs.readFile(__dirname + "/" + "../assets/basic_command_code_lang_en.json", { encoding: "utf8" }),
        fs.readFile(__dirname + "/" + "../assets/basic_mystic_code_lang_en.json", { encoding: "utf8" }),
        fs.readFile(__dirname + "/" + "../assets/basic_war_lang_en.json", { encoding: "utf8" }),
        fs.readFile(__dirname + "/" + "../assets/basic_event_lang_en.json", { encoding: "utf8" }),
    ])
        .then(([iServants, iSvts, iCCs, iMCs, iWars, iEvents]) => {
            servants = JSON.parse(iServants) as Servant.Servant[];
            basicJPSvts = JSON.parse(iSvts) as Entity.EntityBasic[];
            basicJPCCs = (JSON.parse(iCCs) as CommandCode.CommandCodeBasic[]).map((cc) => ({
                ...cc,
                collectionNo: 0,
                type: Entity.EntityType.COMMAND_CODE,
            }));
            basicJPMCs = (JSON.parse(iMCs) as MysticCode.MysticCodeBasic[]).map((mc) => ({
                ...mc,
                collectionNo: 0,
                type: "mysticCode" as any,
            }));
            basicJPWars = (JSON.parse(iWars) as typeof basicJPWars).map((war) => ({
                ...war,
                name: war.longName,
                collectionNo: 0,
                type: "war" as any,
            }));
            basicJPEvents = (JSON.parse(iEvents) as typeof basicJPEvents).map((event) => ({
                ...event,
                collectionNo: 0,
                type: "event" as any,
            }));
        })
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
                console.log(
                    `\x1B[36m${error.message}\x1B[0m [\x1B[34mRun with \x1B[1mreload-servants\x1B[0m\x1B[34m: \x1B[35m${shouldReloadSvts}\x1B[0m.]`
                );
            } else if (error instanceof SyntaxError && error.message.includes("JSON")) {
                console.log("...Something went wrong while parsing local svts, fetching now.");
                downloadSvts().then(() => loadSvts());
            } else {
                throw new Error("...Something went wrong while loading local svts.", { cause: error });
            }
        });

const checkHashMatch = () => {
    let remoteInfo: { [key in "JP" | "NA" | "CN" | "KR" | "TW"]: { hash: string; timestamp: number } };

    const downloadRemoteInfo = fetch("https://api.atlasacademy.io/info")
        .then((response) => response.json() as Promise<typeof remoteInfo>)
        .then((fetchedRemoteInfo) => {
            remoteInfo = fetchedRemoteInfo;
            fs.writeFile(__dirname + "/" + "../assets/api-info.json", JSON.stringify(remoteInfo));

            return remoteInfo;
        });

    return Promise.allSettled([downloadRemoteInfo, fs.readFile(__dirname + "/" + "../assets/api-info.json", { encoding: "utf8" })]).then(
        ([fetchedRemoteInfo, loadedLocalInfo]) => {
            if (loadedLocalInfo.status === "rejected") {
                if ((loadedLocalInfo.reason as NodeJS.ErrnoException).code === "ENOENT") {
                    console.log(`\x1B[34m${__dirname + "/" + "../assets/api-info.json"}\x1B[0m doesn't exist, writing now.`);
                    fs.writeFile(__dirname + "/" + "../assets/api-info.json", JSON.stringify(remoteInfo));
                } else {
                    throw new Error("...Something went wrong while loading local api-info.", { cause: loadedLocalInfo.reason as Error });
                }

                return true; // shouldUpdateServants
            } else {
                let loadedLocalInfoJSON;

                // local api-info loaded
                try {
                    loadedLocalInfoJSON = JSON.parse(loadedLocalInfo.value);
                } catch (error) {
                    if (error instanceof SyntaxError && error.message.includes("JSON")) {
                        console.log("...Something went wrong while parsing local api-info, fetching now.");

                        return true; // shouldUpdateServants
                    }
                }

                if (fetchedRemoteInfo.status === "rejected") {
                    throw new Error("...Something went wrong while fetching api-info.", { cause: fetchedRemoteInfo.reason as Error });
                }

                return !(fetchedRemoteInfo.value.JP.hash === (loadedLocalInfoJSON as typeof remoteInfo).JP.hash);
            }
        }
    );
};

/**
 * Initialises servant list and Bazett's Fragarach NP
 */
const init = () => {
    const tLoadStart = performance.now();

    console.log("Loading svts...");

    NAApiConnector.servantList().then((basicServants: Servant.ServantBasic[]) => (basicNAServants = basicServants));

    return new Promise<void>((resolve, reject) => {
        try {
            checkHashMatch()
                .then((shouldUpdateSvts) => {
                    return shouldUpdateSvts || shouldReloadSvts ? downloadSvts() : loadSvts();
                })
                .then(() => {
                    fuseServants = new Fuse<Servant.Servant>(
                        servants.map((svt) => ({ ...svt, nicknames: nicknames[svt?.collectionNo] ?? [] })),
                        {
                            keys: ["name", "originalName", "id", "collectionNo", "nicknames"],
                            threshold: 0.2,
                        }
                    );

                    const searchArray: any = [
                        ...basicJPSvts.map((svt) => ({ ...svt, nicknames: nicknames[svt?.collectionNo] ?? nicknames[svt?.id] ?? [] })),
                        ...basicJPCCs,
                        ...basicJPMCs,
                        ...basicJPWars,
                        ...basicJPEvents,
                    ];

                    fuseSvts = new Fuse<
                        (
                            | Entity.EntityBasic
                            | CommandCode.CommandCodeBasic
                            | MysticCode.MysticCodeBasic
                            | War.WarBasic
                            | Event.EventBasic
                        ) & {
                            collectionNo: number;
                            type: Entity.EntityType;
                        }
                    >(searchArray, {
                        keys: ["name", "originalName", "nicknames", "longName"],
                        threshold: 0.4,
                    });

                    const tLoadEnd = performance.now();

                    console.log(`Svts loaded [Total: \x1B[31m${((tLoadEnd - tLoadStart) / 1000).toFixed(4)} s\x1B[0m]`);

                    setTimeout(init, 900000);

                    return JPApiConnector.noblePhantasm(1001150);
                })
                .then((NP) => {
                    bazettNP = NP;
                })
                .then(resolve);
        } catch (error) {
            fs.unlink(__dirname + "/" + "../assets/api-info.json").then(() => reject(error));
        }
    });
};

/** Checks if a given entity is an enemy:
 * Enemies have `type: "enemy"` by definition, so to check if the given entity is an enemy, simply check that the type is "enemy"
 * @param entity Entity of type {@link Enemy.Enemy} | `{ detail: string }`, to be checked
 * @returns boolean: true if `entity.type === "enemy"`, false otherwise
 */
const isEnemy = (entity: Servant.Servant | Enemy.Enemy): entity is Enemy.Enemy => ["enemy", "enemyCollection"].includes(entity.type);

/**
 * Get servant or enemy entity from servant collectionNo or enemy ID; rejects if invalid ID or collectionNo, or if any other error encountered
 * @param svtName The servant name, collectionNo or enemy ID to search
 * @returns Promise resolved with the entity matching the given name, collectionNo or ID; rejected if not found
 */
const getSvt = async (svtName: string): Promise<{ svt: Servant.Servant | Enemy.Enemy; NAServant: boolean }> => {
    let svtId =
        +svtName === +svtName // svtName is number?
            ? +svtName // if it's not a number, then it's a nickname, so fetch C.No. from nicknames
            : +(Object.keys(nicknames).find((id) => nicknames?.[+id]?.includes(svtName)) ?? NaN); // If undefined then set to NaN

    let svt: Servant.Servant | Enemy.Enemy | null;

    if (svtId === svtId && svtId.toString().length >= 6) {
        // svtId is an ID and not a collectionNo or nickname
        // query api with svtId and set svt to the result
        svt = await ((await fetch(`https://api.atlasacademy.io/nice/JP/svt/${svtId}?lang=en`)).json() as Promise<
            Enemy.Enemy | Servant.Servant
        >);

        if ((svt as unknown as { detail: string }).detail) {
            const error = new Error(`Svt not found — ${svtId === svtId ? svtId : svtName}`);
            throw error;
        }
    } else {
        //svtId is a collectionNo or nickname
        svtId =
            svtId === svtId // svtId is not NaN?
                ? svtId // no change if not NaN
                : // if NaN, query api with svt name and fetch the ID of the enemy
                  (
                      await ((await fetch(`https://api.atlasacademy.io/basic/JP/svt/search?name=${svtName}&lang=en`)).json() as Promise<
                          Enemy.Enemy[]
                      >)
                  )?.filter((svt) => isEnemy(svt))?.[0]?.id ??
                  // If no such svt, set ID as NaN
                  NaN;

        svt =
            svtId === svtId // If svtId has been resolved to a valid ID or C.No.
                ? servants.find((servant) => servant.collectionNo === svtId) ?? null
                : // If svtId has still not been resolved, try fuzzy searching with the name
                  fuseServants.search(svtName)[0]?.item ?? null;

        if (svt === null) {
            // If svt is still null, it must be an enemy
            const enemy = await ((await fetch(`https://api.atlasacademy.io/nice/JP/svt/${svtId}?lang=en`)).json() as Promise<Enemy.Enemy>);

            if ((!isEnemy(enemy) && svtId !== 600710) /* Hyde as zerk */ || (enemy as unknown as { detail: string }).detail) {
                const error = new Error(`Svt not found — ${svtId === svtId ? svtId : svtName}`);
                throw error;
            }

            svt = enemy;
        }
    }

    if (svt.collectionNo === 336 /* bazett */) {
        if (!bazettNP) {
            bazettNP = await JPApiConnector.noblePhantasm(1001150);
        }

        svt.noblePhantasms = [bazettNP];
    }

    return { svt, NAServant: basicNAServants.find((servant) => servant.id === svt?.id) !== undefined };
};

/**
 * Searches for entity by name or part of name. Returns the resuling {@link Entity.EntityBasic} array, or empty array if no results found.
 * @param svtName The servant name (or part thereof) to search
 * @returns Promise resolved with the array of entities matching the given search term, or empty array if no results found
 */
const getEntities = (
    svtName: string
): ((Entity.EntityBasic | CommandCode.CommandCodeBasic | MysticCode.MysticCodeBasic | War.WarBasic | Event.EventBasic) & {
    collectionNo: number;
    type: Entity.EntityType;
})[] => {
    const svtId =
        +svtName === +svtName // svtName is number?
            ? +svtName // if it's not a number, then it's a nickname, so set svtId to NaN
            : NaN;

    let svt: Entity.EntityBasic | null;

    // If the input is a number, an exact match is required
    if (svtId === svtId) {
        // If svtId is a number, then it is an ID or C.No.
        svt = basicJPSvts.find((svt) => svt.id === svtId) ?? null;

        if (svt === null) {
            // If svt is null, then svtId is C.No.
            svt = basicJPSvts.find((svt) => svt.collectionNo === svtId) ?? null;
        }

        if (svt !== null) {
            // If svt is not null, return the match
            return [svt];
        }

        // Else, it must be part of a name
    }

    // If the input is not a number, then it is a name or part of a name
    // Return the results of fuzzy searching with the name
    const svts = fuseSvts.search(svtName, { limit: 20 }).map((result) => result.item);

    return svts;
};

export { getSvt, getEntities, init };
