# 05 — Text to Speech (Cartesia)

## The one rule

**Never synthesize at request time for stock content.** The word bank is fixed
and small (~5,800 words). Synthesize every clip once, store it, serve it as a
static file. Live synthesis is reserved for user-uploaded words, which are the
only genuinely unpredictable text in the system.

Pre-generation buys four things at once:

| | Live synthesis | Pre-generated |
| --- | --- | --- |
| Latency | 300–900 ms per word | ~0 (local file) |
| Cost | Per play, forever | Once per clip, ever |
| Offline | Impossible | Works |
| Pronunciation QA | Impossible — output varies | A human can verify every clip |

That last row is the important one. You cannot ship a spelling app whose
pronunciation you have not verified, and you cannot verify audio you generate
fresh on every play.

## Pipeline

```
words table
    │
    ├─ build synthesis text  (tts_override_text ?? word)
    ├─ sha256(voice_id + "\n" + text)  ──► text_hash
    │
    ├─ audio_assets lookup on (voice_id, text_hash)
    │        hit  ──► done, nothing to do
    │        miss ──► Cartesia synthesize
    │                  │
    │                  ├─ encode to AAC/m4a, 24 kHz mono
    │                  ├─ upload to Storage: audio/{voice_id}/{hash[0:2]}/{hash}.m4a
    │                  └─ insert audio_assets row
    │
    └─ pronunciation QA queue (flagged + 10% random sample)
```

Three clips per word: the word itself, the definition, and the sample sentence.
Generate all three in the same batch.

The `text_hash` covers the *exact* synthesized text, so editing a definition
automatically produces a new asset rather than silently serving stale audio. The
old asset is left in place until a sweep removes assets no row references.

## Content-addressed storage layout

```
audio/{voice_id}/{hash[0:2]}/{hash}.m4a
```

Sharding on the first two hex characters keeps directory listings sane. The path
is derivable from the row, so the client can build a URL without a round trip
once it has the manifest.

## Client playback

1. Look up the local audio index (SwiftData) for `(word_id, kind, voice_id)`
2. Hit → play the local file with `AVAudioPlayer`
3. Miss → fetch from the CDN, write to the cache directory, then play
4. Offline pack downloads pre-populate the cache in bulk

Audio files live in `Library/Caches` (evictable by the OS) unless the user has
explicitly downloaded an offline pack, in which case they go in
`Library/Application Support` with `isExcludedFromBackup = true`. Downloaded
packs the user paid for should not vanish under storage pressure.

Configure the audio session as `.playback` with `.duckOthers` so the app works
with music playing, and handle interruption notifications — a phone call
mid-word must not leave the session stuck.

## Playback controls (the bee affordances)

These are cheap to build once audio is local, and they are the format's actual
value:

| Control | Behavior |
| --- | --- |
| Repeat | Replay the word clip |
| Slow | `AVAudioPlayer.rate = 0.75` with `enableRate` — no second synthesis needed |
| Definition | Play the definition clip |
| Part of speech | Spoken, not just displayed |
| Use it in a sentence | Play the sentence clip |
| Language of origin | Spoken from `language_of_origin` |
| Alternate pronunciation | Second `audio_assets` row, `kind = 'word_alt'` |

Count replays per attempt (`attempts.replays`) — heavy replay is a signal that a
word is hard for this learner independent of whether they got it right, and it
feeds difficulty estimation.

## Pronunciation overrides

When Cartesia mispronounces a word, do not accept it and do not hand-record it.
Set `words.tts_override_text` to text that synthesizes correctly and re-run:

- Respelling is usually enough: `epitome` → `eh-PIT-oh-mee`
- Use Cartesia's phoneme/IPA control where the API supports it — check the
  current API reference for the supported markup before designing around it
- Homographs need the disambiguating context stripped back out, so an override
  for `read` (past tense) may need to be `red`

Every override must be re-listened to. `pronunciation_verified_at` is set only
by a human action.

## Voice selection

Ship two or three voices and let paid users choose. Do not let the choice
multiply the QA burden: verify pronunciation on **one canonical voice**, then
spot-check the others on the flagged set only. A mispronunciation is usually a
property of the text, not the voice.

Store `voice_id` on the profile. Changing voices means a new pack download —
warn the user before a 70 MB re-fetch.

## Cost model

| Stage | Volume | Note |
| --- | --- | --- |
| Initial generation | ~5,800 words × 3 clips × 2 voices ≈ 35k clips | One-time |
| Content edits | Low hundreds per month | Only changed text re-synthesizes |
| User uploads | Metered: 200 clips/day/paid user | The only ongoing variable cost |
| Playback | $0 | Static CDN file |

The steady-state TTS bill for stock content is zero. Budget the one-time
generation as a content cost alongside the word bank, and rate-limit uploads (see
doc 03) so the variable line stays bounded.

## Security

The Cartesia API key lives in the Edge Function environment and nowhere else. The
`/tts` function:

1. Verifies the Supabase JWT and resolves the account
2. Reads `accounts.entitlement` server-side — never trusts a client claim
3. Checks the daily rate limit
4. Moderates the text (uploads only) before synthesis
5. Returns a **signed Storage URL**, not raw audio bytes

Never proxy audio bytes through the function; you pay egress twice and lose CDN
caching.

## Fallback

If Cartesia is unavailable and a clip is missing, fall back to `AVSpeechSynthesizer`
(the on-device system voice, which is what the current web prototype uses via
`window.speechSynthesis`) and mark the attempt so it can be excluded from
pronunciation-sensitive analytics. Degraded audio is better than a dead session,
but it should be visible in the data.
