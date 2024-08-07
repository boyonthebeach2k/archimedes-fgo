import { CommandObject } from "./interfaces/command-object.interfaces";

/**
 * Aliases and descriptions for each command argument
 *
 */
const commands: {
    [key in keyof CommandObject]: {
        aliases: string[];
        param?: "boolean" | "number" | "number[]" | "verbosity";
        description?: string;
        type?: string;
    };
} = {
    // Servant stats
    level: { aliases: ["l", "lv", "lvl"], param: "number", description: "Servant Level (default: ungrailed level cap)", type: "General" },
    npLevel: { aliases: ["np"], param: "number", description: "Servant NP Level (1 to 5, default: np5)", type: "General" },
    ocLevel: {
        aliases: ["oc"],
        param: "number",
        description: "Servant NP OC Level (1 to 5, default: np5) (used for Gong and Arash NP)",
        type: "General",
    },
    fou: { aliases: ["f"], param: "number", description: "Fou ATK stat (default: 1k)", type: "General" },
    fouPaw: { aliases: ["fp"], param: "number", description: "Command Card Enhancement (Fou Paw) (default: 0)", type: "General" },
    str: {
        aliases: [],
        param: "number",
        description: "NP strengthening (1 for str, 0 for not; default: na availability. str1 for Astarte quick NP and Melusine buster NP)",
        type: "General",
    },
    ce: { aliases: ["c"], param: "number", description: "CE ATK stat (default: 0)", type: "General" },
    totalAttack: {
        aliases: ["ta"],
        param: "number",
        description: "Sets total attack stat, overrides fou/fou paw and ce atk",
        type: "Shorthands",
    },
    super: { aliases: [], param: "boolean", description: "Forces L100 F2000", type: "General" },
    hyper: { aliases: ["superer", "supergrail", "supersuper"], param: "boolean", description: "Forces L120 F2000", type: "Shorthands" },
    classScoreMax: {
        aliases: ["classscore", "classscoremax", "cs", "csmax", "score"],
        param: "boolean",
        description: "Adds maxed-out class score buffs",
        type: "Shorthands",
    },
    // Craft essence
    superad: { aliases: ["superaerialdrive"], param: "boolean", description: "Forces ce2000 n10 bm10 (Aerial Drive)", type: "Shorthands" },
    superof: { aliases: ["superoceanflyer"], param: "boolean", description: "Forces ce2000 n15 am8 (Ocean Flyer)", type: "Shorthands" },
    superck: { aliases: ["supercranking"], param: "boolean", description: "Forces ce2000 n15 bm8 (Cranking)", type: "Shorthands" },
    superbg: { aliases: ["superblackgrail", "sbg"], param: "boolean", description: "Forces ce2400 n80 (Black Grail)", type: "Shorthands" },
    superfondant: {
        aliases: [],
        param: "boolean",
        description: "Forces ce2000 p30 (Fondant); caution: P30 is applied regardless of enemy trait",
        type: "Shorthands",
    },
    superhns: {
        aliases: ["superhnd", "superholynightsupper", "superholynightdinner"],
        param: "boolean",
        description: "Forces ce2000 n15 cd15 (Holy Night Supper)",
        type: "Shorthands",
    },
    superscope: {
        aliases: ["sscope", "skscope", "superkscope", "superkaleidoscope"],
        param: "boolean",
        description: "Forces ce2000 (Kaleidoscope)",
        type: "Shorthands",
    },
    supersumo: { aliases: ["supergoldensumo"], param: "boolean", description: "Forces ce2000 a15 (Golden Sumo)", type: "Shorthands" },
    // Command cards
    arts: { aliases: ["a"], param: "boolean", description: "Calc arts card", type: "Command cards" },
    buster: { aliases: ["b"], param: "boolean", description: "Calc buster card", type: "Command cards" },
    quick: { aliases: ["q"], param: "boolean", description: "Calc quick card", type: "Command cards" },
    extra: { aliases: ["e"], param: "boolean", description: "Calc extra card", type: "Command cards" },
    first: {
        aliases: ["1"],
        param: "boolean",
        description: "Calc first card (implicit when card alone is specified)",
        type: "Command cards",
    },
    second: { aliases: ["2"], param: "boolean", description: "Calc second card", type: "Command cards" },
    third: { aliases: ["3"], param: "boolean", description: "Calc third card", type: "Command cards" },
    weak: { aliases: ["w"], param: "boolean", description: "Calc weak attack (enemy only)", type: "Command cards" },
    strength: { aliases: ["s"], param: "boolean", description: "Calc strong attack (enemy only)", type: "Command cards" },
    // Command card args
    critical: { aliases: ["crit"], param: "boolean", description: "Force critical hits", type: "Command cards" },
    artsFirst: { aliases: ["af"], param: "boolean", description: "Set arts first card bonus", type: "Command cards" },
    busterFirst: { aliases: ["bf"], param: "boolean", description: "Set buster first card bonus", type: "Command cards" },
    quickFirst: { aliases: ["qf"], param: "boolean", description: "Set quick first card bonus", type: "Command cards" },
    noBusterFirst: { aliases: ["nobf"], param: "boolean", description: "Remove buster first card bonus", type: "Command cards" },
    busterChain: { aliases: ["bc"], param: "boolean", description: "For buster/extra card in buster chain", type: "Command cards" },
    braveChain: {
        aliases: ["brave"],
        param: "boolean",
        description: "Force brave chain (redundant, this is automatically set)",
        type: "Command cards",
    },
    extraCardModifier: {
        aliases: ["ecm"],
        param: "number",
        description: "Set extra card modifier in the damage formula",
        type: "Command cards",
    },
    cardValue: { aliases: ["cmv"], param: "number", description: "Override card damage multiplier", type: "Command cards" },
    npValue: {
        aliases: ["npv", "npval", "npoverride", "npo"],
        param: "number",
        description: "Override NP damage multiplier",
        type: "Command cards",
    },
    ocValue: {
        aliases: ["ocv", "ocval", "ocoverride", "oco"],
        param: "number",
        description: "Override OC NP damage multiplier (currently used for Gong and Arash only)",
        type: "Command cards",
    },
    setNp: { aliases: ["snp"], param: "number", description: "Choose which NP from the servant's NP list to use", type: "Command cards" },
    rng: { aliases: ["r"], param: "number", description: "Force a particular rng roll to calc", type: "Command cards" },
    // Command card buffs
    atkMod: {
        aliases: ["a", "atk"],
        param: "number[]",
        description: "Servant ATK X% up/down (put - in front of down values)",
        type: "Command card buffs",
    },
    defMod: { aliases: ["d", "def"], param: "number[]", description: "Target DEF X% up/down", type: "Command card buffs" },
    cardPower: {
        aliases: ["ca", "cp"],
        param: "number[]",
        description: "Card strength X% up/down (see Prisma Causeway World End Match card damage bonus CEs)",
        type: "Command card buffs",
    },
    cardMod: {
        aliases: ["cm", "m"],
        param: "number[]",
        description: "Servant card performance X% up/down, or target card resistance X% up/down",
        type: "Command card buffs",
    },
    artsCardPower: {
        aliases: ["aa", "ap", "acp"],
        param: "number[]",
        description: "Arts card strength X% up/down (see Prisma Causeway World End Match card damage bonus CEs)",
        type: "Command card buffs",
    },
    artsMod: {
        aliases: ["am"],
        param: "number[]",
        description: "Arts card performance X% up/down, or target arts card resistance X% up/down",
        type: "Command card buffs",
    },
    busterCardPower: {
        aliases: ["ba", "bp", "bcp"],
        param: "number[]",
        description: "Buster card strength X% up/down (see Prisma Causeway World End Match card damage bonus CEs)",
        type: "Command card buffs",
    },
    busterMod: {
        aliases: ["bm"],
        param: "number[]",
        description: "Buster card performance X% up/down, or target buster extra card resistance X% up/down",
        type: "Command card buffs",
    },
    quickCardPower: {
        aliases: ["qa", "qp", "qcp"],
        param: "number[]",
        description: "Quick card strength X% up/down (see Prisma Causeway World End Match card damage bonus CEs)",
        type: "Command card buffs",
    },
    quickMod: {
        aliases: ["qm"],
        param: "number[]",
        description: "Quick card performance X% up/down, or target quick card resistance X% up/down",
        type: "Command card buffs",
    },
    extraMod: {
        aliases: ["em"],
        param: "number[]",
        description: "Extra card performance X% up/down, or target extra card resistance X% up/down",
        type: "Command card buffs",
    },
    extraCardPower: {
        aliases: ["ea", "ep", "ecp"],
        param: "number[]",
        description: "Extra card strength X% up/down (see Astarte's post-NP buff)",
        type: "Command card buffs",
    },
    npMod: { aliases: ["n"], param: "number[]", description: "Servant NP Damage X% up/down", type: "Command card buffs" },
    npModDown: { aliases: ["n"], param: "number[]", description: "Servant NP Damage X% up/down (internal)" },
    npPower: {
        aliases: ["npp", "ns"],
        param: "number[]",
        description: "Servant NP Damage Buff Strength X% up/down (e.g. Oberon s3)",
        type: "Command card buffs",
    },
    powerMod: {
        aliases: ["p", "pmod"],
        param: "number[]",
        description: "Special attack bonus (powermod) for trait damage (e.g. jack oc, raikou s3) or event modifiers",
        type: "Command card buffs",
    },
    critDamageMod: { aliases: ["cd", "critdamage"], param: "number[]", description: "Critical damage X% up/down", type: "" },
    artsCritDamageMod: {
        aliases: ["acd", "acm", "artscritdamage"],
        param: "number[]",
        description: "Arts critical damage X% up/down",
        type: "Command card buffs",
    },
    busterCritDamageMod: {
        aliases: ["bcd", "bcm", "bustercritdamage"],
        param: "number[]",
        description: "Buster critical damage X% up/down",
        type: "Command card buffs",
    },
    quickCritDamageMod: {
        aliases: ["qcd", "qcm", "quickcritdamage"],
        param: "number[]",
        description: "Quick critical damage X% up/down",
        type: "Command card buffs",
    },
    flatDamage: {
        aliases: ["fd", "ad"],
        param: "number[]",
        description: "Flat damage up/down by X points (e.g. waver s3, saberlot OC)",
        type: "Command card buffs",
    },
    superEffectiveMod: {
        aliases: ["se", "semod"],
        param: "number[]",
        description: "Trait-based supereffective np dmg increase (e.g. 150 at oc1 for gilgamesh)",
        type: "Command card buffs",
    },
    specialAttackMod: {
        aliases: ["attackspecialdamage", "sam", "specialattackmodifier"],
        param: "number[]",
        description: "upDamageSpecial/downDamageSpecial buff, separately multiplies with all other buffs",
        type: "Command card buffs",
    },
    specialDefenseMod: {
        aliases: ["dr", "sdm", "specialdefensemodifier"],
        param: "number[]",
        description: "Special defense up/down (e.g. Gawain's damage reduction in camelot)",
        type: "Command card buffs",
    },
    // Non-offensive
    npGain: { aliases: ["npgen", "npg", "ng"], param: "number[]", description: "NP charge rate X% up/down", type: "Non-offensive buffs" },
    flatRefund: {
        aliases: ["flatgain", "fr"],
        param: "number[]",
        description: "Flat NP charge gained after the turn",
        type: "Non-offensive buffs",
    },
    starGen: { aliases: ["sg"], param: "number[]", description: "Critical star rate X% up/down", type: "Non-offensive buffs" },
    flatStars: {
        aliases: ["fs"],
        param: "number[]",
        description: "Flat critical stars gained after the turn",
        type: "Non-offensive buffs",
    },
    cardRefundValue: {
        aliases: ["crv"],
        param: "number[]",
        description: "Override cardNPValue in the refund formula",
        type: "Non-offensive buffs",
    },
    cardStarValue: {
        aliases: ["csv"],
        param: "number[]",
        description: "Override cardStarValue in the stargen formula",
        type: "Non-offensive buffs",
    },
    hitCountOverride: {
        aliases: ["hc", "hco", "hits"],
        param: "number",
        description:
            "Override card hitcount; redistributes card damage over the specified hitcount [E.g. Musashi's Fifth Force]. ⚠️ **MUST BE A MULTIPLE OR SUBMULTIPLE OF EXISTING HITCOUNTS**",
        type: "Non-offensive buffs",
    },
    hitMultiplier: {
        aliases: ["hm", "hx", "hitsx"],
        param: "number",
        description:
            "Multiply card hitcount by over the specified number [E.g. Musashi's Fifth Force]. ⚠️ **MUST BE A MULTIPLE OR SUBMULTIPLE OF EXISTING HITCOUNTS**",
        type: "Non-offensive buffs",
    },
    // Enemy args
    enemyHp: {
        aliases: ["hp"],
        param: "number",
        description: "HP of the target enemy, toggles refund and stargen calcs",
        type: "Non-offensive buffs",
    },
    enemyServerMod: {
        aliases: ["esm", "servermod"],
        param: "number",
        description: "Override enemyservermod for refund calcs; usually no reason to set it manually",
        type: "Non-offensive buffs",
    },
    enemyServerRate: {
        aliases: ["esr", "serverrate"],
        param: "number",
        description: "Override enemyservermod for stargen calcs; usually no reason to set it manually",
        type: "Non-offensive buffs",
    },
    // Enemy class
    saber: { aliases: ["seiba"], param: "boolean", description: "", type: "Enemy class" },
    archer: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    lancer: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    rider: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    caster: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    assassin: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    berserker: { aliases: ["zerk", "zerker"], param: "boolean", description: "", type: "Enemy class" },
    shielder: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    ruler: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    alterego: { aliases: ["ae"], param: "boolean", description: "", type: "Enemy class" },
    avenger: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    demongodpillar: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    beastii: { aliases: ["b2", "beast2"], param: "boolean", description: "", type: "Enemy class" },
    beasti: { aliases: ["b1", "beast1"], param: "boolean", description: "", type: "Enemy class" },
    mooncancer: { aliases: ["mc"], param: "boolean", description: "", type: "Enemy class" },
    beastiiir: { aliases: ["b3r", "beast3r", "beast3/r", "beastiii/r"], param: "boolean", description: "", type: "Enemy class" },
    foreigner: { aliases: ["forina"], param: "boolean", description: "", type: "Enemy class" },
    beastiiil: { aliases: ["b3l", "beast3l", "beast3/l", "beastiii/l"], param: "boolean", description: "", type: "Enemy class" },
    beastunknown: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    pretender: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    beastiv: { aliases: ["b4", "beast4"], param: "boolean", description: "", type: "Enemy class" },
    beastilost: { aliases: [], param: "boolean", description: "", type: "Enemy class" },
    /**
     * There are (at the time of writing):
     *   33 enemies with beast attribute, and 2 beast class enemies in the master data
     *   63 known quests where you fight beast attribute enemies, and 5 where you fight beast class enemies (only event quests)
     * Hence, the switch `beast` the same way it has always been used; to refer to the attribute, and beastClass to the class instead.
     */
    beastClass: {
        aliases: ["bclass", "cbeast", "ceast", "classbeast"],
        param: "boolean",
        description: "This also sets the 'beast' enemy attribute by default unless attribute is specified.",
        type: "Enemy class",
    },
    uolgamariealiengod: {
        aliases: ["uolga", "ag", "aliengod", "fg", "foreigngod"],
        param: "boolean",
        description: "",
        type: "Enemy class",
    },
    cccfinaleemiyaalter: {
        aliases: ["brokenarcher", "cccarcher", "cccarcherclass"],
        param: "boolean",
        description: "",
        type: "Enemy class",
    },
    classOverride: { aliases: ["cao"], param: "number", description: "Overrides class advantage modifier", type: "Command card buffs" },
    // Enemy attribute
    human: { aliases: ["man"], param: "boolean", description: "", type: "Enemy attribute" },
    sky: { aliases: [], param: "boolean", description: "", type: "Enemy attribute" },
    earth: { aliases: [], param: "boolean", description: "", type: "Enemy attribute" },
    star: { aliases: [], param: "boolean", description: "", type: "Enemy attribute" },
    beast: {
        aliases: ["abeast", "attribeast", "attribbeast", "beasta", "beastattrib", "beastattribute"],
        param: "boolean",
        description: "",
        type: "Enemy attribute",
    },
    attributeOverride: {
        aliases: ["aao"],
        param: "number",
        description: "Overrides attribute advantage modifier",
        type: "Command card buffs",
    },
    // Internal
    verboseLevel: {
        aliases: ["v", "verbosity"],
        param: "verbosity",
        description: "Toggle increasingly verobse output by including v, vv or vvv",
        type: "Aux",
    },
    nonVerbose: { aliases: ["nv"], param: "boolean", description: "More silent output", type: "Aux" },
    dump: { aliases: [], param: "boolean", description: "Get the command str and chain values for each card in a chain", type: "Aux" },
    reducedHp: {
        aliases: [],
        param: "number",
        description: "Override reducedHp value (useful for calcing cards in a chain separately; automatically managed in chain calc)",
        type: "Aux",
    },
    mightyChain: {
        aliases: ["jpchain", "jc", "mighty", "mightychain"],
        param: "boolean",
        description: "~~Toggle mighty chain first card bonus for cards~~ Enabled by default",
        type: "Aux",
    },
    unknownArgs: { aliases: [] },
    waves: {
        aliases: [],
        description:
            "Putting servants within [] will group them in a wave and calc accordingly. x * N multipliers are supported both for waves as well as for enemies within waves\n[See <#972044071214383124> for further info]",
        type: "Non-offensive buffs",
    },
    comments: {
        aliases: [],
        description: "/ ... inline comments ... / and # End-of-line comments; these are ignored, and just for user convenience",
    },
    calcString: { aliases: [] },
};

export { commands };
