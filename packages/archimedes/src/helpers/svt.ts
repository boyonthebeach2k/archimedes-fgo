import { ApiConnector, Enemy, Language, NoblePhantasm, Region, Servant } from "@atlasacademy/api-connector";
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

const shouldReloadServants = process.argv.map((arg) => arg.toLowerCase()).includes("reload-servants");

let servants: Servant.Servant[], bazettNP: NoblePhantasm.NoblePhantasm, basicNAServants: Servant.ServantBasic[];
let fuseServants: Fuse<Servant.Servant>;

const downloadServants = () =>
    JPApiConnector.servantListNice()
        .then((svts) => {
            servants = svts;
            return fs.writeFile(__dirname + "/" + "../assets/nice_servants.json", JSON.stringify(servants));
        })
        .then(() => console.log("Servants updated."));

const loadServants = () =>
    fs
        .readFile(__dirname + "/" + "../assets/nice_servants.json", { encoding: "utf8" })
        .then((data) => {
            servants = JSON.parse(data) as Servant.Servant[];
        })
        .catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") {
                console.log(
                    `\x1B[36m${
                        __dirname + "/" + "../assets/nice_servants.json"
                    }\x1B[0m not found (\x1B[34mRun with \x1B[1mreload-servants\x1B[0m\x1B[34m: \x1B[35m${shouldReloadServants}\x1B[0m).`
                );
            } else {
                throw new Error("...Something went wrong while loading local servants.", { cause: error });
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

    console.log("Loading servants...");

    NAApiConnector.servantList().then((basicServants: Servant.ServantBasic[]) => (basicNAServants = basicServants));

    return new Promise<void>((resolve, reject) => {
        try {
            checkHashMatch()
                .then((shouldUpdateServants) => {
                    return shouldUpdateServants || shouldReloadServants ? downloadServants() : loadServants();
                })
                .then(() => {
                    fuseServants = new Fuse<Servant.Servant>(servants, {
                        keys: ["name", "originalName", "id", "collectionNo"],
                        threshold: 0.4,
                    } as any);

                    const tLoadEnd = performance.now();

                    console.log(`Servants loaded [Total: \x1B[31m${((tLoadEnd - tLoadStart) / 1000).toFixed(4)} s\x1B[0m]`);

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
        +svtName === +svtName // svt is number?
            ? +svtName // if it's not a number, then it's a nickname, so fetch C.No. from nicknames
            : +Object.keys(nicknames).find((id) => nicknames[+id].includes(svtName))!; // If undefined then +undefined returns NaN

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
        let enemy = await ((await fetch(`https://api.atlasacademy.io/nice/JP/svt/${svtId}?lang=en`)).json() as Promise<Enemy.Enemy>);

        if (!isEnemy(enemy) || (enemy as any).detail) {
            let error = new Error(`Svt not found — ${svtId === svtId ? svtId : svtName}`);
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

export { getSvt, init };
