# Content pipeline

Turns raw word-list data into rows in the multi-user schema
(`supabase/migrations/`), then pre-renders the audio for them.

Nothing here talks to a live service by default. `import.mjs` emits SQL and
`tts/generate.mjs` prints a plan, so a run can always be reviewed and costed
before anything is written or paid for.

```
lib/
  syllables.mjs   heuristic syllable counter
  patterns.mjs    which spelling rules a word exercises -> words.error_patterns
  difficulty.mjs  difficulty score and band assignment
  sentence.mjs    locating the target word in its sample sentence, for masking
  hash.mjs        content addressing for audio clips
  enrich.mjs      composes the above into a `words` row
import.mjs        CSV -> SQL (default) or -> Supabase (--apply)
tts/plan.mjs      decides which clips still need synthesizing (pure, tested)
tts/generate.mjs  runs the plan against Cartesia (--apply)
test/             node:test suites for everything above
```

## Importing words

```sh
npm install

# Review the SQL before it touches anything
npm run words:import -- wordlist.csv --out seed.sql

# Refuse to proceed on blocking problems (a skipped row, a homophone with no
# definition — which cannot be answered from audio alone)
npm run words:import -- wordlist.csv --strict --out seed.sql

# Or push straight to Supabase (needs SUPABASE_SERVICE_ROLE_KEY)
npm run words:import -- wordlist.csv --apply
```

Only `word` is required. Recognized columns:

```
word, part_of_speech, definition, definition_reading_level, sample_sentence,
ipa, tts_override_text, language_of_origin, homophone_group, frequency_rank,
age_gated, list_band, source, license
```

Derived automatically: `syllables`, `error_patterns`, `sentence_mask_start`,
`sentence_mask_end`, and band membership. A `list_band` value always overrides
the computed band — Dolch, Fry, and the Scripps lists encode grade judgments no
scorer can reconstruct.

Generated SQL is idempotent: words upsert on their unique spelling, membership
upserts on its composite key, so re-running a seed file is a no-op.

## Pre-generating audio

```sh
npm run tts:plan     # what would be synthesized, and roughly how many characters
npm run tts:apply    # synthesize, upload to storage, record in audio_assets
```

Clips are content-addressed on `sha256(voice_id + "\n" + text)`. Editing a
definition therefore produces a new asset instead of silently serving a clip of
the old text, and a second run over unchanged content costs nothing.

Every newly synthesized clip is **unverified**. Run the pronunciation QA pass and
set `words.pronunciation_verified_at` before serving to paid users — see
`docs/02-word-bank.md`.

> The Cartesia request shape in `tts/generate.mjs` has not been verified against
> the current API reference (`docs/12-open-questions.md`, Q5). Confirm it — and
> whether phoneme/IPA control is available — before the first paid run.

## Tests

```sh
npm test
```

Pure logic only, no network and no database. The library covers syllable
counting, pattern tagging, difficulty banding, sentence masking, content
hashing, enrichment, and TTS planning.
