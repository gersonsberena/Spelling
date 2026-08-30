/**
 * Classify *how* a word was misspelled.
 *
 * This is the attempt-level counterpart to lib/patterns.mjs (which tags what a
 * word exercises). It is the feature the subscription is actually for: knowing
 * that a learner misses double consonants is worth far more than knowing they
 * missed "necessary". Taxonomy and rationale in docs/06-learning-engine.md.
 *
 * Determinism matters — the Swift port must agree exactly, since scheduling and
 * reports are computed on device and cross-checked on the server. No locale
 * behavior, no iteration over unordered collections, output always sorted.
 */

/** QWERTY neighbours, for separating a thumb slip from a spelling error. */
const ADJACENT = {
  q: "wa", w: "qeas", e: "wrsd", r: "etdf", t: "ryfg", y: "tugh", u: "yijh",
  i: "uokj", o: "iplk", p: "ol", a: "qwsz", s: "awedxz", d: "serfcx",
  f: "drtgvc", g: "ftyhbv", h: "gyujnb", j: "huikmn", k: "jiolm", l: "kop",
  z: "asx", x: "zsdc", c: "xdfv", v: "cfgb", b: "vghn", n: "bhjm", m: "njk",
};

const SILENT_GRAPHEMES = [
  ["kn", "n"], ["wr", "r"], ["gn", "n"], ["ps", "s"], ["mb", "m"],
  ["gh", ""], ["bt", "t"], ["mn", "m"], ["rh", "r"], ["lm", "m"],
];

const SOUND_ALIKE = [
  ["ph", "f"], ["f", "ph"], ["c", "k"], ["k", "c"], ["c", "s"], ["s", "c"],
  ["z", "s"], ["s", "z"], ["j", "g"], ["g", "j"], ["qu", "kw"], ["x", "ks"],
];

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** Longest first, so a longer prefix is never shadowed by a shorter one. */
const PREFIXES = ["inter", "over", "dis", "mis", "un", "im", "ir", "il"];

/**
 * @param {string} target the correct spelling
 * @param {string} submitted what the learner typed
 * @param {object} [ctx]
 * @param {string[]} [ctx.homophones] other spellings sharing the homophone group
 * @param {number} [ctx.latencyMs]
 * @param {number} [ctx.medianLatencyMs]
 * @returns {{correct: boolean, editDistance: number, patterns: string[]}}
 */
export function classifyAttempt(target, submitted, ctx = {}) {
  const t = norm(target);
  const s = norm(submitted);

  if (t === s) return { correct: true, editDistance: 0, patterns: [] };

  const editDistance = damerauLevenshtein(t, s);
  const patterns = new Set();

  // A homophone substitution is a meaning error, not an orthography error, and
  // is the one case where the learner may have spelled a real word perfectly.
  if ((ctx.homophones ?? []).map(norm).includes(s)) {
    return { correct: false, editDistance, patterns: ["homophone"] };
  }

  // A thumb slip is not a spelling problem. Counting it as one poisons the
  // parent report, so it is classified alone and excluded from aggregates.
  if (isTypo(t, s, editDistance, ctx)) {
    return { correct: false, editDistance, patterns: ["typo"] };
  }

  if (isTransposition(t, s)) {
    patterns.add("transposition");
    if (/ie|ei/.test(t) && /ie|ei/.test(s)) patterns.add("ie_ei");
  }

  if (doubledRuns(t) !== doubledRuns(s)) patterns.add("double_consonant");
  if (suffixDoublingError(t, s)) patterns.add("suffix_doubling");
  if (silentEError(t, s)) patterns.add("silent_e");
  if (pluralRuleError(t, s)) patterns.add("plural_rule");
  if (silentLetterError(t, s)) patterns.add("silent_letter");
  if (prefixBoundaryError(t, s)) patterns.add("prefix");

  const sub = singleSubstitution(t, s);
  if (sub) {
    if (VOWELS.has(sub.from) && VOWELS.has(sub.to)) patterns.add("vowel_substitution");
    else if (!VOWELS.has(sub.from) && !VOWELS.has(sub.to)) patterns.add("consonant_substitution");
  }

  if (patterns.size === 0 && soundsAlike(t, s)) patterns.add("phonetic");

  return { correct: false, editDistance, patterns: [...patterns].sort() };
}

/** Optimal string alignment distance; adjacent transposition costs 1. */
export function damerauLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function isTypo(t, s, distance, ctx) {
  if (distance !== 1 || t.length !== s.length) return false;
  const sub = singleSubstitution(t, s);
  if (!sub) return false;
  if (!(ADJACENT[sub.from] ?? "").includes(sub.to)) return false;

  // Adjacency alone is not enough — "cat"/"vat" is adjacent but plausibly a real
  // error. Require the answer to have come back unusually fast as well.
  const { latencyMs, medianLatencyMs } = ctx;
  if (!Number.isFinite(latencyMs) || !Number.isFinite(medianLatencyMs)) return false;
  return latencyMs < medianLatencyMs * 0.6;
}

function isTransposition(t, s) {
  if (t.length !== s.length) return false;
  const diff = [];
  for (let i = 0; i < t.length; i++) if (t[i] !== s[i]) diff.push(i);
  return diff.length === 2 && diff[1] === diff[0] + 1 &&
    t[diff[0]] === s[diff[1]] && t[diff[1]] === s[diff[0]];
}

function singleSubstitution(t, s) {
  if (t.length !== s.length) return null;
  let found = null;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === s[i]) continue;
    if (found) return null;
    found = { from: t[i], to: s[i], index: i };
  }
  return found;
}

/** Number of doubled-letter runs, e.g. "necessary" -> 1, "accommodate" -> 2. */
function doubledRuns(w) {
  return (w.match(/([a-z])\1/g) ?? []).length;
}

function suffixDoublingError(t, s) {
  const m = /^(.*?)([bdglmnprt])\2(ing|ed|er|est)$/.exec(t);
  if (!m) return false;
  return s === `${m[1]}${m[2]}${m[3]}`;
}

function silentEError(t, s) {
  if (t.endsWith("e") && s === t.slice(0, -1)) return true;
  if (s.endsWith("e") && t === s.slice(0, -1)) return true;
  // "hoping" vs "hopeing": the silent e should have been dropped before -ing.
  const stem = /^(.*)e(ing|ed)$/.exec(s);
  return Boolean(stem && t === `${stem[1]}${stem[2]}`);
}

function pluralRuleError(t, s) {
  const rules = [
    [/ies$/, (w) => `${w.slice(0, -3)}ys`],
    [/ves$/, (w) => `${w.slice(0, -3)}fs`],
    [/oes$/, (w) => `${w.slice(0, -2)}s`],
    [/es$/, (w) => `${w.slice(0, -2)}s`],
  ];
  return rules.some(([re, wrong]) => re.test(t) && s === wrong(t));
}

function silentLetterError(t, s) {
  return SILENT_GRAPHEMES.some(([full, reduced]) =>
    t.includes(full) && s === t.replace(full, reduced));
}

/**
 * The doubling straddles the prefix boundary — "mis" + "spell", "un" + "natural"
 * — so the repeated letter is the prefix's last character meeting the stem's
 * first, not a doubled letter sitting after the prefix.
 */
function prefixBoundaryError(t, s) {
  for (const prefix of PREFIXES) {
    if (!t.startsWith(prefix)) continue;
    if (t[prefix.length] !== prefix.at(-1)) continue;
    if (s === prefix + t.slice(prefix.length + 1)) return true;
  }
  return false;
}

function soundsAlike(t, s) {
  return SOUND_ALIKE.some(([a, b]) => t.includes(a) && s === t.replace(a, b));
}

const norm = (w) => String(w ?? "").toLowerCase().replace(/[^a-z]/g, "");
