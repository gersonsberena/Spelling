# Spelling

A spelling practice app. This repository currently contains a working web
prototype and the design documentation for the iOS app it is becoming.

## Documentation

Design docs live in [`docs/`](docs/README.md) — product brief, monetization,
word bank sourcing, architecture, data model, text-to-speech pipeline, learning
engine, gamification, AI features, iOS implementation notes, compliance, and the
roadmap.

Start with [`docs/README.md`](docs/README.md).

## The prototype

A single-page web app that runs the core loop: it presents a word with its part
of speech and definition, speaks it aloud, and checks what you type. Missed words
can be retested, and sessions are recorded to a history view.

```
index.html      markup for the setup, quiz, summary, and history screens
app.js          session logic, Supabase queries, speech synthesis
styles.css      styling
supabase/       schema and incremental migrations
scripts/        word import (CSV → Supabase) and config generation
```

### Running it locally

1. Create a Supabase project and run `supabase/migration.sql` in the SQL editor.
2. Copy `config.example.js` to `config.js` and fill in the project URL and anon key.
3. Import a word list:

   ```sh
   npm install
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import-words
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

See [`docs/04-data-model.md`](docs/04-data-model.md) for the multi-user schema
that replaces it.
