import { countSyllables } from "./syllables.mjs";
import { wordErrorPatterns } from "./patterns.mjs";

/** Band slugs in ascending order; must match the seed in migration 0007. */
export const BANDS = [
  "grade_1_2",
  "grade_3_5",
  "grade_6_8",
  "high_school_sat",
  "adult_general",
  "adult_professional",
];

/** Upper score bound for each band, walked in order. */
const THRESHOLDS = [22, 40, 56, 70, 84, Infinity];

/**
 * Difficulty score for a word, 0 (easiest) to 100.
 *
 * Deliberately *not* a hand-assigned number. docs/02-word-bank.md ranks the
 * signals: published list membership beats everything, then corpus frequency,
 * then orthographic complexity. Observed miss rate outranks all of these once
 * there is real traffic — recompute bands quarterly against it rather than
 * trusting this function forever.
 *
 * @param {object} w
 * @param {string} w.word
 * @param {number} [w.frequencyRank] 1 = most common. Omit if unknown.
 * @param {string[]} [w.errorPatterns] defaults to deriving them from the spelling
 */
export function difficultyScore({ word, frequencyRank, errorPatterns }) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;

  const patterns = errorPatterns ?? wordErrorPatterns(w);
  const syllables = countSyllables(w);

  // Frequency: the strongest available signal. Log-scaled, because the gap
  // between rank 10 and 100 matters far more than 10,000 and 10,090.
  let frequency = null;
  if (Number.isFinite(frequencyRank) && frequencyRank > 0) {
    const t = (Math.log10(frequencyRank) - 2) / 3; // rank 100 -> 0, rank 100k -> 1
    frequency = clamp01(t) * 45;
  }

  const length = clamp01((w.length - 3) / 11) * 20;
  const syllable = clamp01((syllables - 1) / 4) * 20;
  const pattern = clamp01(patterns.length / 5) * 15;

  const orthographic = length + syllable + pattern; // 0..55

  // Without frequency the orthographic signal has to carry the whole range, so
  // rescale rather than reporting an artificially low score.
  if (frequency === null) return Math.round(clamp01(orthographic / 55) * 100);

  return Math.round(frequency + orthographic);
}

/**
 * Band for a word. An explicit published-list assignment always wins — Dolch,
 * Fry, and the Scripps school lists encode grade judgments this scorer cannot.
 *
 * @param {object} w — as difficultyScore, plus:
 * @param {string} [w.listBand] band slug from a published list
 * @returns {string} band slug
 */
export function assignBand(w) {
  if (w.listBand) {
    if (!BANDS.includes(w.listBand)) {
      throw new Error(`unknown band: ${w.listBand}`);
    }
    return w.listBand;
  }
  const score = difficultyScore(w);
  return BANDS[THRESHOLDS.findIndex((t) => score <= t)];
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}
