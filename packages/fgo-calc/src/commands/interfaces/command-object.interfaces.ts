/**
 * Describes servant base stats such as level, ce atk, np level, etc
 */
export interface ServantBaseStats {
    // Servant stats
    level: number;
    npLevel: number;
    fou: number;
    fouPaw: number;
    str: boolean;
    ce: number;
    totalAttack: number;
    super: boolean;
    hyper: boolean;
}

/**
 * Describes the object holding various buff values and switches that is used in the calu (insert link) function
 */
export interface CommandObject extends ServantBaseStats {
    // Craft essence
    superad: boolean;
    superbg: boolean;
    superfondant: boolean;
    superhns: boolean;
    superscope: boolean;
    supersumo: boolean;

    // Command cards
    first: boolean;
    second: boolean;
    third: boolean;
    extra: boolean;
    arts: boolean;
    buster: boolean;
    quick: boolean;
    weak: boolean;
    strength: boolean;

    // Command card args
    critical: boolean;
    artsFirst: boolean;
    busterFirst: boolean;
    quickFirst: boolean;
    noBusterFirst: boolean;
    busterChain: boolean;
    braveChain: boolean;
    extraCardModifier: number;
    cardValue: number;
    npValue: number;
    setNp: number;
    rng: number;

    // Command card buffs
    //    Type 1
    atkMod: number;
    defMod: number;
    //    Type 2
    cardPower: number;
    cardMod: number;
    artsCardPower: number;
    artsMod: number;
    busterCardPower: number;
    busterMod: number;
    quickCardPower: number;
    quickMod: number;
    extraMod: number;
    extraCardPower: number;
    //    Type 3
    npMod: number;
    powerMod: number;
    critDamageMod: number;
    artsCritDamageMod: number;
    busterCritDamageMod: number;
    quickCritDamageMod: number;
    //    Miscellaneous
    flatDamage: number;
    superEffectiveMod: number;
    specialAttackMod: number;
    specialDefenseMod: number;

    // Non-offensive
    /* stars: boolean; */
    npGain: number;
    flatRefund: number;
    starGen: number;
    flatStars: number;
    cardRefundValue: number;
    cardStarValue: number;

    // Enemy args
    enemyHp: number;
    enemyServerMod: number;
    enemyServerRate: number;

    // Enemy class
    saber: boolean;
    archer: boolean;
    lancer: boolean;
    rider: boolean;
    caster: boolean;
    assassin: boolean;
    berserker: boolean;
    shielder: boolean;
    ruler: boolean;
    alterego: boolean;
    avenger: boolean;
    demongodpillar: boolean;
    beastii: boolean;
    beasti: boolean;
    mooncancer: boolean;
    beastiiir: boolean;
    foreigner: boolean;
    beastiiil: boolean;
    beastunknown: boolean;
    pretender: boolean;
    beastiv: boolean;
    cccfinaleemiyaalter: boolean;
    classOverride: number;

    // Enemy attribute
    human: boolean;
    sky: boolean;
    earth: boolean;
    star: boolean;
    beast: boolean;

    // Internal
    verboseLevel: number;
    nonVerbose: boolean;
    dump: boolean;
    reducedHp: number;
    unknownArgs: string[];
    waves: never;
    comments: never;

    // Internal ^2 (not included in cmdArgs)
    calcString: string;
}
