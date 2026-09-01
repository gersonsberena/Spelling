/**
 * Heuristic English syllable counter.
 *
 * Used for difficulty scoring and for the "how many letters and syllables" hint.
 * It is a heuristic, not a dictionary: it counts vowel groups, then corrects for
 * silent terminal `e` and the consonant+`le` ending.
 *
 * Known limitation: adjacent vowels that belong to separate syllables are
 * counted as one group, so `idea` (i-de-a) returns 2 rather than 3. Where a
 * source supplies IPA, prefer counting stress marks in `ipa` over calling this.
 *
 * @param {string} word
 * @returns {number} at least 1
 */
export function countSyllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const groups = w.match(/[aeiouy]+/g);
  if (!groups) return 1;
  let n = groups.length;

  // Terminal silent `e` ("make" -> 1), but not the consonant+`le` syllable
  // ("table", "apple"), where the `e` carries its own beat.
  if (w.endsWith("e") && !/[^aeiouy]le$/.test(w)) n -= 1;

  // `-es` and `-ed` are usually not their own syllable ("hopes", "hoped"),
  // except after a sibilant or `t`/`d` ("wishes", "wanted").
  if (/[^aeiouy](es|ed)$/.test(w) && !/(s|sh|ch|x|z|t|d)(es|ed)$/.test(w)) n -= 1;

  // Medial silent `e` swallowed by a following suffix: "definitely" is
  // def-i-nite-ly, not def-i-nit-e-ly. Also "lonely", "movement", "hopeful".
  if (/[^aeiouy]e(ly|ness|ment|ful|less)$/.test(w)) n -= 1;

  return Math.max(1, n);
}
