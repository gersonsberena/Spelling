/**
 * Which spelling rules a word *exercises*.
 *
 * This populates `words.error_patterns`, which targeted drills select on. It is
 * deliberately distinct from `attempts.error_patterns`, which records how a
 * given learner actually tripped — that classifier lives in the app and runs
 * against a submitted string. Names are shared with the taxonomy in
 * docs/06-learning-engine.md so the two sides join cleanly.
 *
 * Attempt-only categories (`phonetic`, `transposition`, `typo`) never appear
 * here: they are properties of a mistake, not of a word.
 */

const DOUBLE_CONSONANT = /([bcdfglmnprstz])\1/;
const SUFFIX_DOUBLING = /([bdglmnprt])\1(ing|ed|er|est|y)$/;
const SILENT_LETTER = [
  /^kn/, /^wr/, /^gn/, /^ps/, /^pn/, /^mn/,
  /mb$/, /bt$/, /mn$/, /gh/, /^rh/, /lm$/, /st(en|le)$/,
];
const PREFIX_BOUNDARY = /^(dis|mis|un|im|ir|il|inter|over)(s|s|n|m|r|l|r|r)/;
const CONSONANT_SUBSTITUTION = [
  /ph/, /que$/, /^ch/, /tch/, /c[eiy]/, /g[eiy]/, /sc[eiy]/, /^x/,
];
/** Endings whose vowel reduces to a schwa and is therefore easy to mis-hear. */
const SCHWA_AFFIX = /(ance|ence|ant|ent|able|ible|ar|er|or|ur|ain|ate|ite)$/;
const PLURAL_RULE = /(ies|ves|oes|xes|ches|shes|sses)$/;

/**
 * @param {string} word
 * @param {{ homophoneGroup?: string|null }} [opts]
 * @returns {string[]} sorted, deduplicated pattern slugs
 */
export function wordErrorPatterns(word, opts = {}) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  const out = new Set();
  if (!w) return [];

  if (DOUBLE_CONSONANT.test(w)) out.add("double_consonant");
  if (SUFFIX_DOUBLING.test(w)) out.add("suffix_doubling");
  if (/ie|ei/.test(w)) out.add("ie_ei");
  if (PLURAL_RULE.test(w)) out.add("plural_rule");
  if (PREFIX_BOUNDARY.test(w)) out.add("prefix");
  if (SCHWA_AFFIX.test(w)) out.add("vowel_substitution");
  if (SILENT_LETTER.some((re) => re.test(w))) out.add("silent_letter");
  if (CONSONANT_SUBSTITUTION.some((re) => re.test(w))) out.add("consonant_substitution");

  // Terminal silent `e`: a consonant, then `e`, and not the consonant+`le`
  // syllable, which is pronounced.
  if (/[^aeiou]e$/.test(w) && !/[^aeiou]le$/.test(w) && w.length > 3) {
    out.add("silent_e");
  }

  if (opts.homophoneGroup) out.add("homophone");

  return [...out].sort();
}
