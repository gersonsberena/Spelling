# 03 — Architecture

## Principles

1. **Local-first.** The app must be fully usable with no network: a car, a
   classroom with bad wifi, a plane. Content and audio are downloaded as packs;
   attempts are recorded locally and synced opportunistically.
2. **Nothing that costs money runs on the client's word.** TTS synthesis and LLM
   generation are server-mediated, entitlement-checked, and rate-limited.
3. **No third-party keys in the app bundle.** Ever. See "Secrets" below.
4. **The server is the source of truth for content; the client is the source of
   truth for attempts.** Conflicts on attempt data resolve last-write-wins by
   device timestamp; conflicts on content always defer to the server.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Swift 6 + SwiftUI, iOS 17+ | Widgets, Live Activities, PencilKit, SwiftData all mature at 17 |
| Local store | SwiftData (or GRDB if SwiftData's migration story bites) | Offline-first attempt log and content cache |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Already in use by the prototype; RLS gives per-user isolation cheaply |
| Serverless | Supabase Edge Functions (Deno) | Cartesia proxy, LLM proxy, report generation, webhooks |
| Audio CDN | Supabase Storage + CDN | Pre-rendered word audio, served as static files |
| Subscriptions | RevenueCat → webhook → Supabase | See doc 01 |
| Analytics | TelemetryDeck or self-hosted PostHog | Must be COPPA-compatible; see doc 10 |
| Crash | Xcode Organizer / MetricKit | Avoids a third-party SDK in a kids app |

Keeping Supabase means the prototype's schema and import tooling
(`scripts/import-words.mjs`) carry forward rather than being thrown away, and it
gives Postgres — which the learning engine's scheduling queries genuinely want.

## Component map

```
┌──────────────────────── iOS app ────────────────────────┐
│  SwiftUI shells (K-2 / 3-8 / HS-Adult)                  │
│  Session engine ── Scheduler (FSRS) ── Error analyzer   │
│  SwiftData: profiles, word cache, attempts, audio index │
│  AVAudioPlayer over locally cached audio files          │
└───────────────┬──────────────────────────┬──────────────┘
                │ sync (batched)           │ signed URLs
┌───────────────▼──────────────┐  ┌────────▼───────────────┐
│ Supabase Postgres + RLS      │  │ Supabase Storage + CDN │
│  profiles, words, lists,     │  │  audio/{voice}/{hash}  │
│  attempts, review_state,     │  │  offline pack manifests│
│  sessions, uploads           │  └────────────────────────┘
└───────────────┬──────────────┘
                │
┌───────────────▼───────────────────────────────────────────┐
│ Edge Functions                                            │
│  /tts        → Cartesia (entitlement + rate limited)      │
│  /generate   → LLM sentence gen (moderated, cached)       │
│  /import     → OCR + word enrichment for uploads          │
│  /report     → weekly parent report email                 │
│  /revenuecat → subscription webhook                       │
└───────────────┬───────────────────────────────────────────┘
                │
        Cartesia API   •   LLM API   •   Vision/OCR
```

## Offline packs

A pack is a versioned bundle for one band and one voice:

- A JSON manifest of words with definitions, POS, sentences, IPA, metadata
- Audio files for word, definition, and sentence
- A content version so the client can diff and fetch only changed entries

Packs are downloaded on Wi-Fi by default, with an explicit "download for offline"
control. A grade band of ~1,500 words at ~15 KB per audio clip across three clips
per word is roughly 70 MB — acceptable as an opt-in download, too large to ship
in the bundle. Ship only the user's selected band, plus Word of the Day.

## Sync model

The client keeps an append-only local `attempts` log. On foreground, on session
end, and on a background task:

1. Push unsynced attempts in batches (idempotent on a client-generated UUID)
2. Pull `review_state` changes for the active profile
3. Pull content manifest diffs for downloaded packs

Scheduling (which word comes next, when) is computed **on device** from local
review state so a session never blocks on the network. The server recomputes the
same state from the attempt log as a cross-check and as the source for reports
and multi-device use.

## Secrets

The prototype ships `config.js` with the Supabase anon key inline. That is
acceptable *only* because the anon key is designed to be public and RLS is the
actual boundary — which means RLS must be real (see doc 04). It is not a pattern
to extend.

- Cartesia API key: Edge Function environment only. Never in the app, never in a
  client-readable table, never in a repo.
- LLM API key: same.
- Supabase service role key: server and CI only. `scripts/import-words.mjs`
  already requires it via environment variable — keep it that way.
- Add a `.env.example` and keep real values out of git. Confirm `.gitignore`
  covers `config.js` and `.env*`.

## Rate limiting

Every Edge Function that spends money enforces, per profile:

| Endpoint | Free | Paid |
| --- | --- | --- |
| `/tts` (uncached text) | Denied | 200 clips/day |
| `/generate` (sentence) | Denied | 100/day |
| `/import` | Denied | 20 lists/day, 500 words/list |

Cached content never touches these endpoints — it is a static CDN fetch.
