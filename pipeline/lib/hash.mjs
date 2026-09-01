import { createHash } from "node:crypto";

/**
 * Content address for a synthesized audio clip.
 *
 * Keying on (voice, exact text) is what makes the TTS cache correct rather than
 * merely fast: editing a definition changes the hash, so the app fetches new
 * audio instead of silently serving a clip of the old text. See
 * docs/05-text-to-speech.md.
 *
 * @param {string} voiceId
 * @param {string} text
 * @returns {string} 64 hex characters, matching the audio_assets.text_hash check
 */
export function audioTextHash(voiceId, text) {
  return createHash("sha256").update(`${voiceId}\n${text}`, "utf8").digest("hex");
}

/**
 * Storage path for a clip. Sharded on the first two hex characters so no single
 * directory holds every asset. Derivable from the row, so a client that has the
 * manifest can build the URL without a round trip.
 */
export function audioStoragePath(voiceId, hash, ext = "m4a") {
  return `audio/${voiceId}/${hash.slice(0, 2)}/${hash}.${ext}`;
}
