# Spelling App — Design Documentation

Planning and design docs for an iOS spelling app spanning early elementary
through adult learners. The repository currently contains a working web
prototype (`index.html`, `app.js`, `supabase/`); these documents describe the
product it should become and the gaps between here and there.

## Read in this order

| Doc | What it covers |
| --- | --- |
| [00 — Product Brief](00-product-brief.md) | Vision, audience, positioning, what makes this different |
| [01 — Monetization](01-monetization.md) | Free vs. paid, pricing, paywall placement, family/classroom |
| [02 — Word Bank & Content](02-word-bank.md) | Sourcing, licensing, grade leveling, homophones, QA |
| [03 — Architecture](03-architecture.md) | Stack, offline-first sync, backend services, secrets |
| [04 — Data Model](04-data-model.md) | Multi-user Postgres schema, RLS, migration from the prototype |
| [05 — Text to Speech (Cartesia)](05-text-to-speech.md) | Pre-generation pipeline, caching, cost model, pronunciation QA |
| [06 — Learning Engine](06-learning-engine.md) | Spaced repetition, mastery states, error analysis taxonomy |
| [07 — Gamification & Retention](07-gamification.md) | Streaks, XP, mastery map, Word of the Day, widgets, notifications |
| [08 — AI Features](08-ai-features.md) | Sentence generation, caching, moderation, reading-level control |
| [09 — iOS Implementation](09-ios-implementation.md) | Age shells, input modes, the autocorrect trap, accessibility |
| [10 — Compliance & Privacy](10-compliance-privacy.md) | COPPA, App Store Kids Category, parental gates, data handling |
| [11 — Roadmap](11-roadmap.md) | v1 / v2 / v3 scope, milestones, cut list |
| [12 — Open Questions](12-open-questions.md) | Decisions that still need an owner |

## Current state of the repository

The prototype is a single-user, single-page web app:

- Vanilla JS + Supabase (`words`, `word_stats`, `sessions`, `session_words`)
- `window.speechSynthesis` for audio (browser voices, not Cartesia)
- Practice mode and retest-missed mode, plus session history
- `grade_level` exists on `words` but is filtered by a hardcoded constant, not chosen by the user
- No authentication; every RLS policy is `using (true)`

It is a useful proof of the core loop. It is **not** a foundation for a
multi-user product — see [04 — Data Model](04-data-model.md) for what has to
change before launch.
