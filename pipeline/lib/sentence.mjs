/**
 * Locate the target word inside its sample sentence.
 *
 * The sentence is spoken in full, but when it is *displayed* the target has to
 * be masked or it gives away the answer. Offsets are stored on the row
 * (words.sentence_mask_start / _end) so masking is mechanical: a naive search at
 * render time breaks on inflected forms, where the sentence says "running" and
 * the word is "run".
 *
 * @param {string} sentence
 * @param {string} word
 * @returns {{start: number, end: number, matched: string} | null}
 */
export function findTarget(sentence, word) {
  const w = String(word).toLowerCase();
  if (!sentence || !w) return null;

  for (const form of inflections(w)) {
    const re = new RegExp(`\\b${escapeRe(form)}\\b`, "i");
    const m = re.exec(sentence);
    if (m) return { start: m.index, end: m.index + m[0].length, matched: m[0] };
  }
  return null;
}

/** Replace the target with a blank of proportional length, for display. */
export function maskSentence(sentence, start, end) {
  if (start == null || end == null) return sentence;
  return sentence.slice(0, start) + "_".repeat(end - start) + sentence.slice(end);
}

/**
 * Plausible surface forms, longest first so "running" is preferred over "run"
 * when both would match.
 */
function inflections(w) {
  const forms = new Set([w]);
  const last = w.at(-1);
  const stem = w.slice(0, -1);

  forms.add(`${w}s`).add(`${w}es`).add(`${w}ed`).add(`${w}ing`).add(`${w}ly`);

  if (last === "e") {
    forms.add(`${stem}ed`).add(`${stem}ing`).add(`${w}d`).add(`${w}s`);
  }
  if (last === "y") {
    forms.add(`${stem}ies`).add(`${stem}ied`);
  }
  // leaf -> leaves, but also knife -> knives, which ends in `fe` not `f`.
  if (last === "f") forms.add(`${stem}ves`);
  if (w.endsWith("fe")) forms.add(`${w.slice(0, -2)}ves`);
  // Doubled final consonant before a vowel suffix: run -> running.
  if (/[aeiou][bdglmnprt]$/.test(w)) {
    forms.add(`${w}${last}ing`).add(`${w}${last}ed`).add(`${w}${last}er`);
  }

  return [...forms].sort((a, b) => b.length - a.length);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
