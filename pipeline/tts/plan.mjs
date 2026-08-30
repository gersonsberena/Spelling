import { audioTextHash, audioStoragePath } from "../lib/hash.mjs";

/**
 * Decide which audio clips still need synthesizing.
 *
 * Kept pure and separate from the Cartesia call so the expensive decision — what
 * to spend money on — is testable without a network or an API key. The rule from
 * docs/05-text-to-speech.md: the word bank is fixed, so every clip is
 * synthesized once and served as a static file forever after.
 *
 * @param {object[]} words rows from `words`
 * @param {string} voiceId
 * @param {Set<string>} existingHashes text_hash values already in audio_assets
 * @returns {{clips: object[], skipped: number, warnings: string[]}}
 */
export function planClips(words, voiceId, existingHashes = new Set()) {
  const clips = [];
  const warnings = [];
  let skipped = 0;

  for (const w of words) {
    for (const [kind, text] of clipTexts(w)) {
      if (!text) continue;
      const hash = audioTextHash(voiceId, text);
      if (existingHashes.has(hash)) {
        skipped += 1;
        continue;
      }
      clips.push({
        word_id: w.id,
        word: w.word,
        kind,
        voice_id: voiceId,
        text,
        text_hash: hash,
        storage_path: audioStoragePath(voiceId, hash),
      });
    }

    // A homophone that reaches a learner without a definition clip is
    // unanswerable — audio alone cannot distinguish their/there/they're.
    if (w.homophone_group && !w.definition) {
      warnings.push(`${w.word}: homophone with no definition to speak`);
    }
  }

  return { clips, skipped, warnings };
}

/**
 * The three clips per word. `tts_override_text` replaces the spelling when the
 * engine mispronounces it — the override is what gets synthesized and hashed,
 * so correcting a pronunciation naturally invalidates the old clip.
 */
function clipTexts(w) {
  return [
    ["word", w.tts_override_text || w.word],
    ["definition", w.definition],
    ["sentence", w.sample_sentence],
  ];
}

/** Rough spend estimate, for sanity-checking a run before starting it. */
export function estimateCharacters(clips) {
  return clips.reduce((n, c) => n + c.text.length, 0);
}
