# Spelling

A spelling practice app. This repository currently contains a working web
prototype and the design documentation for the iOS app it is becoming.

## Documentation

Design docs live in [`docs/`](docs/README.md) — product brief, monetization,
word bank sourcing, architecture, data model, text-to-speech pipeline, learning
engine, gamification, AI features, iOS implementation notes, compliance, and the
roadmap.

Start with [`docs/README.md`](docs/README.md).

## Building the iOS app

Development has started on the backend, which the iOS app depends on and which
the roadmap puts on the critical path.

```
supabase/migrations/   multi-user schema with real row-level security
supabase/local/        local Postgres harness that verifies it
pipeline/              word enrichment, import, TTS pre-generation, test vectors
ios/SpellingCore/      Swift package: scheduler, grader, error classifier
```

```sh
npm install
npm test                                    # pipeline + shared logic
npm run db:verify                           # rebuild schema + RLS suite (needs local Postgres)
npm run vectors                             # regenerate the Swift test vectors
npm run words:import -- words.csv --out seed.sql
npm run tts:plan

cd ios/SpellingCore && swift test            # needs a Mac
```

See [`supabase/README.md`](supabase/README.md),
[`pipeline/README.md`](pipeline/README.md), and [`ios/README.md`](ios/README.md).
Copy `.env.example` to `.env` before running anything that touches a live service.

## The prototype

A single-page web app that runs the core loop: it presents a word with its part
of speech and definition, speaks it aloud, and checks what you type. Missed words
can be retested, and sessions are recorded to a history view.

```
index.html      markup for the setup, quiz, summary, and history screens
app.js          session logic, Supabase queries, speech synthesis
styles.css      styling
supabase/legacy/ the single-user schema it runs on
scripts/        word import (CSV → Supabase) and config generation
```

### Running it locally

1. Create a Supabase project and run `supabase/legacy/migration.sql` in the SQL editor.
   (The prototype runs on the legacy single-user schema, not `supabase/migrations/`.)
2. Copy `config.example.js` to `config.js` and fill in the project URL and anon key.
3. Import a word list:

   ```sh
   npm install
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run legacy:import-words
   ```

   Expects a `wordlist.csv` with columns `word`, `part_of_speech`, `definition`,
   `sample_sentence`, `grade_level`, `source`. Override the path with
   `WORDS_CSV_PATH`.

4. Serve the directory:

   ```sh
   npm run serve
   ```

The service role key is required for import because row-level security grants the
anonymous client only select and update. Keep it out of the browser and out of
version control.

### Prototype limitations

The prototype is single-user by design and is **not** a foundation for a
multi-user product:

- No authentication; every RLS policy is `using (true)`, so anyone with the anon
  key can read and write all data
- `word_stats` is global rather than per-user
- Audio uses the browser's built-in `speechSynthesis`, not Cartesia
- `grade_level` is filtered by a hardcoded constant rather than chosen by the user

The replacement is in [`supabase/migrations/`](supabase/README.md); the reasoning
is in [`docs/04-data-model.md`](docs/04-data-model.md).
