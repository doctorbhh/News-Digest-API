/**
 * Lexicon-based sentiment analyzer.
 *
 * Uses an AFINN-165-inspired word list to score article text and classify
 * sentiment as positive, neutral, or negative. No external dependencies.
 *
 * Approach:
 *   1. Tokenize the combined title + content into lowercase words.
 *   2. Look up each token in the sentiment lexicon (score from -5 to +5).
 *   3. Sum the scores and normalize by token count.
 *   4. Map the normalized score to a label using configurable thresholds.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
    label: SentimentLabel;
    score: number;
}

const LEXICON: Record<string, number> = {
    // strongly negative (-5 to -3)
    abandon: -2, abuse: -3, abysmal: -5, accident: -2, agony: -4,
    annihilate: -4, appalling: -4, assault: -4, atrocious: -5,
    awful: -3, bankrupt: -3, bastard: -5, betray: -3, bitter: -2,
    blame: -2, blast: -2, bleed: -2, bloodshed: -4, bomb: -3,
    brutal: -3, bully: -3, burden: -2, cancel: -1, catastrophe: -4,
    chaos: -3, clash: -2, collapse: -3, conflict: -2, corrupt: -3,
    crash: -3, crime: -3, criminal: -3, crisis: -3, critical: -2,
    cruel: -3, crush: -2, damage: -2, danger: -3, dead: -3,
    deadly: -3, death: -3, debt: -2, defeat: -2, defect: -2,
    demolish: -3, deny: -2, depressed: -3, depression: -3,
    destroy: -3, destruction: -3, devastate: -4, die: -3, dire: -3,
    disaster: -4, disease: -3, disrupt: -2, doom: -4, dread: -3,
    drought: -2, dumb: -3, dump: -2, emergency: -2, evil: -3,
    explode: -3, exploit: -2, extreme: -1, fail: -2, failure: -2,
    fake: -3, fatal: -3, fear: -2, fight: -2, fire: -2,
    flood: -2, fool: -2, fraud: -3, fury: -3, genocide: -5,
    grim: -2, grieve: -2, gun: -1, hack: -2, harm: -2,
    harsh: -2, hate: -4, havoc: -3, hell: -4, helpless: -2,
    horrible: -4, horror: -4, hostile: -2, hurt: -2, illegal: -3,
    impact: -1, infect: -2, injure: -2, insult: -2, invade: -2,
    jail: -2, jeopardize: -2, kill: -3, lack: -2, lawsuit: -2,
    lethal: -3, lie: -2, lose: -2, loss: -3, massacre: -5,
    menace: -2, miserable: -3, mislead: -3, miss: -1, mourn: -2,
    murder: -4, nasty: -3, negate: -2, negative: -2, neglect: -2,
    nightmare: -3, obesity: -2, offend: -2, oppose: -1, outrage: -3,
    pain: -2, panic: -3, penalty: -2, peril: -3, plague: -3,
    plunge: -2, poison: -3, pollute: -2, poor: -2, poverty: -2,
    prison: -2, problem: -2, protest: -1, punish: -2, rage: -3,
    raid: -2, recession: -3, reject: -2, resign: -1, revolt: -2,
    riot: -3, risk: -1, rob: -2, ruin: -3, sacrifice: -1,
    sad: -2, scandal: -3, scare: -2, scream: -2, seize: -2,
    severe: -2, shock: -2, shoot: -3, sick: -2, sin: -2,
    slaughter: -5, slave: -3, smash: -2, sorry: -1, steal: -2,
    storm: -1, strangle: -3, stress: -2, strike: -1, struggle: -2,
    suffer: -2, suicide: -4, suspect: -1, suspend: -1, terrible: -3,
    terror: -4, terrorism: -4, threat: -2, toll: -2, torture: -4,
    toxic: -3, tragedy: -3, tragic: -3, trap: -2, trouble: -2,
    turmoil: -3, ugly: -3, unemployment: -2, unfortunate: -2,
    unhappy: -2, unstable: -2, upset: -2, victim: -3, violate: -3,
    violence: -4, violent: -3, virus: -2, vulnerable: -2, war: -3,
    warn: -2, waste: -2, weak: -2, weapon: -2, weep: -2,
    woe: -3, worse: -3, worst: -4, wound: -2, wreck: -3,

    // positive (+1 to +5)
    accomplish: 2, achieve: 3, admire: 3, advance: 2, advantage: 2,
    agree: 1, amazing: 4, amaze: 4, applaud: 3, appreciate: 2,
    approve: 2, award: 3, awesome: 4, beautiful: 3, benefit: 2,
    best: 3, bloom: 2, boost: 2, brave: 2, breakthrough: 3,
    bright: 2, brilliant: 4, calm: 2, celebrate: 3, champion: 3,
    cheer: 2, clean: 1, comfort: 2, commend: 2, compassion: 3,
    compliment: 2, confidence: 2, congratulate: 3, cooperate: 2,
    courage: 3, create: 1, cure: 3, delight: 3, donate: 2,
    dream: 1, eager: 2, earn: 2, effective: 2, efficient: 2,
    elegant: 3, empower: 3, encourage: 2, enjoy: 2, enormous: 1,
    enthusiastic: 3, excel: 3, excellent: 4, excite: 3, exciting: 3,
    extraordinary: 4, fair: 2, famous: 2, fantastic: 4, favor: 2,
    flourish: 3, forgive: 2, free: 1, freedom: 2, friendly: 2,
    fun: 2, gain: 2, generous: 3, genius: 4, glad: 3,
    glory: 3, good: 2, grace: 2, grand: 3, grateful: 3,
    great: 3, grow: 1, growth: 2, guarantee: 2, happy: 3,
    harmony: 3, heal: 2, healthy: 2, help: 2, hero: 3,
    hope: 2, honor: 3, huge: 1, ideal: 2, improve: 2,
    incredible: 4, innovate: 3, innovation: 3, inspire: 3,
    invest: 1, joy: 3, jubilant: 4, justice: 2, kind: 2,
    launch: 1, lead: 1, legend: 3, liberty: 2, love: 3,
    luck: 2, luxury: 2, magnificent: 4, marvel: 3, master: 2,
    merit: 2, miracle: 4, noble: 2, nurture: 2, optimism: 3,
    outstanding: 4, overcome: 2, paradise: 4, passion: 2, peace: 2,
    perfect: 3, phenomenal: 4, pioneer: 3, pleasant: 2, pleasure: 3,
    positive: 2, power: 1, powerful: 2, praise: 3, premier: 2,
    premium: 2, pride: 2, profit: 2, progress: 2, promise: 1,
    promote: 1, prosper: 3, prosperity: 3, protect: 1, proud: 3,
    recover: 2, reform: 2, relief: 2, remarkable: 4, rescue: 2,
    resolve: 2, respect: 2, restore: 2, reward: 2, rich: 2,
    rise: 1, robust: 2, safe: 2, satisfy: 2, save: 2,
    secure: 2, shine: 2, smart: 2, smile: 2, solution: 2,
    spectacular: 4, splendid: 4, stable: 2, strength: 2, strong: 2,
    succeed: 3, success: 3, super: 3, superior: 3, support: 2,
    supreme: 3, surge: 1, surprise: 1, sustain: 1, terrific: 4,
    thrill: 3, thrive: 3, top: 1, transform: 2, tremendous: 4,
    triumph: 4, trust: 2, unity: 2, upgrade: 2, uplift: 3,
    valuable: 2, victory: 3, virtue: 3, vital: 1, vivid: 2,
    volunteer: 2, wealth: 2, welcome: 2, welfare: 2, win: 3,
    wisdom: 2, wonderful: 4, worthy: 2, wow: 4, yay: 3, yes: 1
};

const NEGATION_WORDS = new Set([
    "not", "no", "never", "neither", "nobody", "nothing",
    "nowhere", "nor", "cannot", "cant", "dont", "doesnt",
    "didnt", "wont", "wouldnt", "shouldnt", "couldnt",
    "isnt", "arent", "wasnt", "werent", "hardly", "barely"
]);

const INTENSIFIERS: Record<string, number> = {
    very: 1.5, extremely: 2.0, incredibly: 2.0, absolutely: 2.0,
    highly: 1.5, deeply: 1.5, truly: 1.3, really: 1.3,
    completely: 1.5, totally: 1.5, utterly: 2.0, most: 1.3,
    remarkably: 1.5, exceptionally: 1.5
};

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(t => t.length > 1);
}

const POSITIVE_THRESHOLD = 0.08;
const NEGATIVE_THRESHOLD = -0.08;

export function analyzeSentiment(title: string, content: string): SentimentResult {
    const text = `${title} ${title} ${content}`;
    const tokens = tokenize(text);

    if (tokens.length === 0) {
        return { label: "neutral", score: 0 };
    }

    let totalScore = 0;
    let scoredTokens = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const lexScore = LEXICON[token];

        if (lexScore === undefined) {
            continue;
        }

        let modifier = 1;

        if (i > 0 && NEGATION_WORDS.has(tokens[i - 1])) {
            modifier = -0.75;
        } else if (i > 1 && NEGATION_WORDS.has(tokens[i - 2])) {
            modifier = -0.5;
        }

        if (i > 0) {
            const intensifier = INTENSIFIERS[tokens[i - 1]];
            if (intensifier && modifier > 0) {
                modifier *= intensifier;
            }
        }

        totalScore += lexScore * modifier;
        scoredTokens++;
    }

    const normalized = scoredTokens > 0 ? totalScore / tokens.length : 0;

    let label: SentimentLabel;
    if (normalized >= POSITIVE_THRESHOLD) {
        label = "positive";
    } else if (normalized <= NEGATIVE_THRESHOLD) {
        label = "negative";
    } else {
        label = "neutral";
    }

    return {
        label,
        score: Math.round(totalScore * 100) / 100
    };
}
