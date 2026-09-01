#!/usr/bin/env node
/**
 * Pre-generate word audio.
 *
 *   node pipeline/tts/generate.mjs --plan            # what would be synthesized (no network)
 *   node pipeline/tts/generate.mjs --apply           # synthesize, upload, record
 *
 * `--plan` is the default and needs no credentials, so a run can always be
 * costed before it is paid for.
 *
 * Never call this at request time. The word bank is fixed, so every clip is
 * synthesized once and afterwards served as a static CDN file — which is what
 * makes audio free at steady state, instant, offline-capable, and, most
 * importantly, verifiable by a human before it ships. See
 * docs/05-text-to-speech.md.
 */

import { planClips, estimateCharacters } from "./plan.mjs";

const VOICE_ID = process.env.CARTESIA_VOICE_ID || "default";

async function main(argv) {
  const apply = argv.includes("--apply");
  const { supabase, serviceRole } = await connect(apply);

  const words = await fetchWords(supabase);
  const existing = await fetchExistingHashes(supabase, VOICE_ID);
  const { clips, skipped, warnings } = planClips(words, VOICE_ID, existing);

  for (const w of warnings) console.error(`  warning: ${w}`);

  console.error(
    `\n${words.length} words; ${clips.length} clips to synthesize, ${skipped} already cached` +
    `\n~${estimateCharacters(clips).toLocaleString()} characters`,
  );

  if (!apply) {
    console.error("\n--plan only. Re-run with --apply to synthesize.");
    for (const c of clips.slice(0, 10)) {
      console.error(`  ${c.kind.padEnd(10)} ${c.word.padEnd(16)} ${c.storage_path}`);
    }
    if (clips.length > 10) console.error(`  ... and ${clips.length - 10} more`);
    return;
  }

  if (!serviceRole) throw new Error("--apply needs SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.CARTESIA_API_KEY) throw new Error("--apply needs CARTESIA_API_KEY");

  let done = 0;
  for (const clip of clips) {
    const audio = await synthesize(clip.text, VOICE_ID);

    const { error: upErr } = await supabase.storage
      .from("audio")
      .upload(clip.storage_path, audio, { contentType: "audio/mp4", upsert: true });
    if (upErr) throw new Error(`upload failed for ${clip.word}: ${upErr.message}`);

    const { error: rowErr } = await supabase.from("audio_assets").upsert({
      word_id: clip.word_id,
      kind: clip.kind,
      voice_id: clip.voice_id,
      text_hash: clip.text_hash,
      storage_path: clip.storage_path,
      bytes: audio.byteLength,
    }, { onConflict: "voice_id,text_hash" });
    if (rowErr) throw new Error(`audio_assets insert failed for ${clip.word}: ${rowErr.message}`);

    if (++done % 25 === 0) console.error(`  ${done} / ${clips.length}`);
  }

  console.error(`\nsynthesized ${done} clips.`);
  console.error(
    "Every new clip is unverified. Run the pronunciation QA pass and set " +
    "words.pronunciation_verified_at before serving these to paid users.",
  );
}

/**
 * Cartesia synthesis.
 *
 * NOTE — docs/12-open-questions.md Q5 is still open: the exact request shape and
 * whether phoneme/IPA control is available have NOT been verified against the
 * current API reference. Check before the first paid run; if only plain-text
 * respelling is supported, the pronunciation QA effort in doc 02 goes up.
 */
async function synthesize(text, voiceId) {
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": process.env.CARTESIA_API_KEY,
      "Cartesia-Version": process.env.CARTESIA_VERSION || "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: text,
      voice: { mode: "id", id: voiceId },
      output_format: { container: "mp3", encoding: "mp3", sample_rate: 24000 },
      model_id: process.env.CARTESIA_MODEL_ID || "sonic-english",
    }),
  });
  if (!res.ok) {
    throw new Error(`cartesia ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function connect(needWrite) {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || (needWrite && !serviceRole)) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient(url, serviceRole, { auth: { persistSession: false } }),
    serviceRole,
  };
}

async function fetchWords(supabase) {
  const { data, error } = await supabase
    .from("words")
    .select("id, word, definition, sample_sentence, tts_override_text, homophone_group");
  if (error) throw new Error(`fetching words: ${error.message}`);
  return data;
}

async function fetchExistingHashes(supabase, voiceId) {
  const { data, error } = await supabase
    .from("audio_assets")
    .select("text_hash")
    .eq("voice_id", voiceId);
  if (error) throw new Error(`fetching audio_assets: ${error.message}`);
  return new Set(data.map((r) => r.text_hash));
}

main(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
