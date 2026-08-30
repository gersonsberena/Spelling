# Legacy prototype schema

The single-user schema the web prototype (`index.html`, `app.js`) runs on.

Kept so the prototype remains runnable. **It is not the path forward** — every
policy here is `using (true)`, `word_stats` is global rather than per-user, and
there is no account or profile concept. See `docs/04-data-model.md` for why and
`supabase/migrations/` for the replacement.

Do not apply these to a project that also has `supabase/migrations/` applied.
