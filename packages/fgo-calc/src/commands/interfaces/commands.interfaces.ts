/**
 * Interface describing describing the properties in the calcTerms object, i.e. the various terms in the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage} formula
 *  (as well as {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas, if applicable)
 * in addition to some internals
 */
export interface CalcTerms {
    //--- Damage
    /** Final servant ATK stat on the current card */
    servantAtk: number;
    /** NP damage multiplier in the damage formula */
    npDamageMultiplier: number;
    /** firstCardBonus in the damage formula: 0.5 if first card is a buster card, 0 otherwise; no bonus to NPs */
    firstCardBonus: number;
    /** Colour- and position-based card multiplier value */
    cardDamageValue: number;
    /** Card effectiveness up or down */
    cardMod: number;
    /** Card strength up/down (see Astarte post-NP buff, Prisma Causeway World End Match card damage bonus CEs) */
    cardPower: number;
    /** Class-dependent atk multiplier */
    classAtkBonus: number;
    /** Class-advantage-based atk multiplier */
    triangleModifier: number;
    /** Attribute-advantage-based atk multiplier */
    attributeModifier: number;
    /** ATK Up/Down */
    atkMod: number;
    /** DEF Up/Down */
    defMod: number;
    /** Whether the facecard is a critical hit */
    isCritical: boolean;
    /** Whether the card is an NP or a faceCard */
    faceCard: boolean;
    /** CRITICAL_ATTACK_RATE|CRITICAL_TD_POINT_RATE: 2 if critical, 1 if not */
    criticalModifier: 1 | 2;
    /** 3.5 if grand chain, 2 if brave chain, 1 if not extra card */
    extraCardModifier: 1 | 2 | 3.5;
    /** Damage reduction/resistance Up/Down (see enemy Gawain in camelot) */
    specialDefMod: number;
    /** Offensive analogue of damage reduction/resistance Up/Down */
    damageSpecialMod: number;
    /** Power/Special damage up/down */
    powerMod: number;
    /** Target's received attack power/special damage up/down */
    selfDamageMod: 0;
    /** Critical strength Up/Down */
    critDamageMod: number;
    /** NP strength Up/Down */
    npDamageMod: number;
    /** Trait-based NP super-effective modifier */
    superEffectiveModifier: number;
    /** Flat damage added after multiplications (non-multiplicative) */
    dmgPlusAdd: number;
    /** Target's received additional added damage after multiplications (non-multiplicative) (see Saberlot NP OC effect) */
    selfDmgCutAdd: 0;
    /** busterChainMod in the damage formula: 0.2 if it's a Buster card in a buster chain, 0 otherwise */
    busterChainMod: 0 | 0.2;

    //--- Refund & Stargen
    /** Base NP gain stat of the servant */
    offensiveNPRate: number;
    /** Base refund value of this card */
    cardNPValue: number;
    /** Enemy multiplier to np gain rate */
    enemyServerMod: number;
    /**  NP charge rate up/down [+-X%] */
    npChargeRateMod: number;
    /** OVER_KILL_NP_RATE: 1.5 if overkill, 1 otherwise */
    overkillModifier: 1.5;
    /** Flat NP charge gain for this card */
    flatRefund: number;

    //--- Stargen
    /** Base star drop rate of the servant */
    baseStarRate: number;
    /** Base star drop chanve of this card */
    cardStarValue: number;
    /** Enemy modifier to star drop rate */
    serverRate: number;
    /** Critical star drop rate up/down [+-X%] */
    starDropMod: number;
    /** +-X% to Critical Star Rate (Star Rate Up/Down); currently unused */
    enemyStarDropMod: 0;
    /** Flat 30% additional chance if overkill */
    overkillAdd: 0.3;
    /** Flat stargen for this card */
    flatStars: number;

    //--- Misc & internal
    /** Chain leading with arts? */
    artsFirst: boolean;
    /** Chain leading with buster? */
    busterFirst: boolean;
    /** Chain leading with quick? */
    quickFirst: boolean;
    /** Name of this card */
    cardName: "NP" | "Arts" | "Buster" | "Quick" | "Extra" | "Weak" | "Strength";
    /** Position of this card */
    cardPosition: "first" | "second" | "third" | "extra" | "none";
    /** Attribute of the enemy */
    enemyAttribute: string;
    /** Class name of the enemy */
    enemyClass: string;
    /** Whether the card is an enemy faceCard */
    enemyFaceCard: boolean;
    /** Current chain enemy HP */
    enemyHp?: number;
    /** Hit distribution of this card */
    hits: number[];
    /** Current chain reducedHp on maxroll */
    maxReducedHp?: number;
    /** Current chain reducedHp on minroll */
    reducedHp?: number;
    /** Exact damage roll instead of damage range */
    rng?: number;
    /** The name of the current servant */
    servantName: string;
    /** The class of the current servant */
    servantClass: string;
    /** Messaage to display for any warnings triggered */
    warnMessage: string;
    /** Verbose level */
    verbosity: "nv" | "" | "v" | "vv" | "vvv";

    /** ATK enhancement for the given servant */
    fou: number;
    /** Command card strengthening for the given card */
    fouPaw: number;
    /** Servant level */
    level: number;
    /** Servant NP Level */
    npLevel: number;
    /** NP strengthening status */
    strengthen: boolean;
    /** CE ATK stat */
    ce: number;
    /** Servant page on AA-DB */
    servantURL: string;
    /** Servant face thumbnail image URL */
    servantThumbnail: string;
    /** The calc string for the given command card, specifying the various switches and buffs */
    calcString: string;
}

export interface NPFields {
    offensiveNPRate: number;
    artsFirst: boolean;
    cardNPValue: number;
    cardMod: number;
    enemyServerMod: number;
    npChargeRateMod: number;
    isCritical: boolean;
    isOverkill: boolean;
    NPRegen: number;
    reducedHp: number;
    currEnemyHP: number;
    enemyHp: number;
    overkillNo: number;
    npPerHit: number[];
    damagePerHit: number[];
    remHPPerHit: number[];
}

export interface StarFields {
    baseStarRate: number;
    quickFirst: boolean;
    cardStarValue: number;
    cardMod: number;
    serverRate: number;
    starDropMod: number;
    enemyStarDropMod: number;
    reducedHp: number;
    isCritical: boolean;
    isOverkill: boolean;
    overkillNo: number;
    minStars: number;
    maxStars: number;
    avgStars: number;
    dropChancePerHit: number[];
}

export interface DamageFields {
    /** Base damage for the current card */
    damage: number;
    /** Lowroll damage for the current card */
    minrollDamage: number;
    /** Highroll damage for the current card */
    maxrollDamage: number;
}

/**
 * Interface describing the various damage, refund and stars values after applying the {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/damage.md damage},
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/np.md refund} and
 * {@link https://github.com/atlasacademy/fgo-docs/blob/master/deeper/battle/critstars.md stargen} formulas
 */
export interface CalcVals {
    calcTerms: CalcTerms;

    damageFields: DamageFields;

    minStarFields: StarFields;
    maxStarFields: StarFields;

    minNPFields: NPFields;
    maxNPFields: NPFields;

    generalFields: {
        baseAtk: number;
        damageMultiplier: number;
        servantClass: string;
        servantName: string;
        servantThumbnail: string;
        servantURL: string;
        verbosity: "nv" | "" | "v" | "vv" | "vvv";
        warnMessage: string;
    };
}

/**
 * Describes the results of calcing a chain of cards for given svt
 */
export interface ChainCalcVals {
    cards: {
        command: string;
        faceCard: boolean;
        name: "arts" | "buster" | "quick" | "extra" | "skip" | "";
    }[];
    baseStr: string;
    calcVals: { minrollCalcVals: CalcVals; maxrollCalcVals: CalcVals }[];
    hasRefundOrStars: boolean;

    totalDamage: number;
    minrollTotalDamage: number;
    maxrollTotalDamage: number;

    accReducedHp: number;
    maxAccReducedHp: number;

    minrollTotalRefund: number;
    maxrollTotalRefund: number;

    minrollTotalMinStars: number;
    minrollTotalMaxStars: number;
    maxrollTotalMinStars: number;
    maxrollTotalMaxStars: number;
    minrollAvgStars: number;
    maxrollAvgStars: number;

    overkillNo: number;
    maxOverkillNo: number;

    warnings: string;
}

/**
 * Describes the results of calcing the given svt & enemies
 */
export interface EnemyCalcVals {
    waves: {
        hasChain: boolean;
        enemyVals: {
            calcVals: CalcVals | ChainCalcVals;
            damage: number;
            minDamage: number;
            maxDamage: number;
            hasRefundOrStars: boolean;
            minNPRegen?: number;
            maxNPRegen?: number;
            minStars?: number;
            maxStars?: number;
            overkillNo?: number;
            maxOverkillNo?: number;
            enemyClass: string;
            enemyAttribute: string;
            warnings: string;
        }[];
        waveFields: {
            totalDamage: number;
            minrollTotalDamage: number;
            maxrollTotalDamage: number;
            minrollTotalRefund: number;
            maxrollTotalRefund: number;
            minrollTotalStars: number;
            maxrollTotalStars: number;
            overkillNo: number;
            maxOverkillNo: number;
            warnings: string;
        };
    }[];
    verboseLevel: number;
}
