import { countSyllables } from "./syllables.mjs";
import { wordErrorPatterns } from "./patterns.mjs";
import { assignBand } from "./difficulty.mjs";
import { findTarget } from "./sentence.mjs";

/**
 * Turn a raw source row into a `words` row plus its band membership.
 *
 * Everything here is derived deterministically from the source data. The two
 * steps that are *not* deterministic — rewriting a definition to a reading level
 * and generating a sentence — are LLM calls that happen upstream of this, so
 * that re-running enrichment never silently changes wording.
 *
 * @param {object} row raw CSV/source row
 * @returns {{ word: object, band: string, warnings: string[] }}
 */
export function enrichWord(row) {
  const warnings = [];
  const word = String(row.word ?? "").trim();
  if (!word) throw new Error("row has no word");
  if (/\s/.test(word)) warnings.push("contains whitespace — is this a phrase?");

  const homophoneGroup = emptyToNull(row.homophone_group);
  const errorPatterns = wordErrorPatterns(word, { homophoneGroup });
  const frequencyRank = toInt(row.frequency_rank);
  const sampleSentence = emptyToNull(row.sample_sentence);

  if (!emptyToNull(row.definition)) warnings.push("no definition");
  if (!sampleSentence) warnings.push("no sample sentence");

  // A homophone is unanswerable from audio alone, so the client must show its
  // definition before enabling the answer field. Without one the word is unusable.
  if (homophoneGroup && !emptyToNull(row.definition)) {
    warnings.push("HOMOPHONE WITHOUT A DEFINITION — unanswerable from audio");
  }

  let maskStart = null;
  let maskEnd = null;
  if (sampleSentence) {
    const target = findTarget(sampleSentence, word);
    if (target) {
      maskStart = target.start;
      maskEnd = target.end;
    } else {
      warnings.push("target word not found in its sample sentence");
    }
  }

  const band = assignBand({
    word,
    frequencyRank: frequencyRank ?? undefined,
    errorPatterns,
    listBand: emptyToNull(row.list_band) ?? undefined,
  });

  return {
    warnings,
    band,
    word: {
      word,
      part_of_speech: emptyToNull(row.part_of_speech),
      definition: emptyToNull(row.definition),
      definition_reading_level: toInt(row.definition_reading_level),
      sample_sentence: sampleSentence,
      sentence_mask_start: maskStart,
      sentence_mask_end: maskEnd,
      ipa: emptyToNull(row.ipa),
      tts_override_text: emptyToNull(row.tts_override_text),
      language_of_origin: emptyToNull(row.language_of_origin),
      homophone_group: homophoneGroup,
      syllables: countSyllables(word) || null,
      frequency_rank: frequencyRank,
      error_patterns: errorPatterns,
      age_gated: truthy(row.age_gated),
      source: emptyToNull(row.source),
      license: emptyToNull(row.license),
    },
  };
}

const emptyToNull = (v) => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const toInt = (v) => {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
};
const truthy = (v) => ["1", "true", "yes", "y"].includes(String(v ?? "").trim().toLowerCase());
