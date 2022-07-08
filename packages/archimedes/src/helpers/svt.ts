import { ApiConnector, Enemy, Entity, Language, NoblePhantasm, Region, Servant } from "@atlasacademy/api-connector";
import { nicknames } from "../assets/assets";
import Fuse from "fuse.js";
import fetch from "node-fetch";
import { promises as fs } from "fs";

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
    basicJPSvts: Entity.EntityBasic[];
let fuseServants: Fuse<Servant.Servant>, fuseSvts: Fuse<Entity.EntityBasic>;

const downloadSvts = () =>
    JPApiConnector.servantListNice()
        .then((svts) => {
            servants = svts;
            return fs.writeFile(__dirname + "/" + "../assets/nice_servants.json", JSON.stringify(servants));
        })
        .then(() => JPApiConnector.entityList())
        .then((basicSvts: Entity.EntityBasic[]) => {
            basicJPSvts = basicSvts;
            return fs.writeFile(__dirname + "/" + "../assets/basic_svt_lang_en.json", JSON.stringify(basicJPSvts));
        })
        .then(() => console.log("Svts updated."));

const loadSvts = () =>
    fs
        .readFile(__dirname + "/" + "../assets/nice_servants.json", { encoding: "utf8" })
        .then((data) => {
            servants = JSON.parse(data) as Servant.Servant[];
        })
        .then(() => fs.readFile(__dirname + "/" + "../assets/basic_svt_lang_en.json", { encoding: "utf8" }))
        .then((data) => {
            basicJPSvts = JSON.parse(data) as Entity.EntityBasic[];
        })
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
                console.log(
                    `\x1B[36m${error.message}\x1B[0m [\x1B[34mRun with \x1B[1mreload-servants\x1B[0m\x1B[34m: \x1B[35m${shouldReloadSvts}\x1B[0m.]`
                );
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
                // local api-info loaded
                if (fetchedRemoteInfo.status === "rejected") {
                    throw new Error("...Something went wrong while fetching api-info.", { cause: fetchedRemoteInfo.reason as Error });
                }

                return !(fetchedRemoteInfo.value.JP.hash === (JSON.parse(loadedLocalInfo.value) as typeof remoteInfo).JP.hash);
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
                    fuseServants = new Fuse<Servant.Servant>(servants, {
                        keys: ["name", "originalName", "id", "collectionNo"],
                        threshold: 0.4,
                    });

                    fuseSvts = new Fuse<Entity.EntityBasic>(
                        basicJPSvts.map((svt) => ({ ...svt, nicknames: nicknames[svt?.collectionNo] ?? [] })),
                        {
                            keys: ["name", "originalName", "nicknames"],
                            threshold: 0.2,
                        }
                    );

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
            reject(error);
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

    let svt: Servant.Servant | Enemy.Enemy | null;

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
const getEntities = (svtName: string): Entity.EntityBasic[] => {
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
