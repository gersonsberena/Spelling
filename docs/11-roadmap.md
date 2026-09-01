# 11 — Roadmap

## Principle for v1

Ship the **complete core loop for one learner**, done properly, rather than every
listed feature done thinly. The loop is: pick a level → hear a word with its
definition and part of speech → spell it → get useful feedback → have missed
words come back on a real schedule → see progress.

Everything in v1 below serves that loop. Everything cut is genuinely valuable and
genuinely not needed to prove the product works.

## v1 — Launch (target ~12 weeks)

### Content (start immediately; it is the long pole)
- [ ] Source and license ~5,800 words across the six bands (doc 02)
- [ ] Enrich: definitions rewritten to reading level, POS, sentences, IPA,
      syllables, `error_patterns`, `homophone_group`
- [ ] Pre-generate audio for all words × 3 clip kinds × 1 canonical voice
- [ ] Human pronunciation QA pass; overrides and re-synthesis
- [ ] Content-safety review; set `age_gated`

### Backend
- [ ] New multi-user schema with real RLS (doc 04)
- [ ] Drop the prototype's `word_stats` / `sessions` / `session_words`
- [ ] Rewrite `scripts/import-words.mjs` for the new columns and list membership
- [ ] TTS pre-generation pipeline + Storage layout (doc 05)
- [ ] Offline pack builder and manifest versioning
- [ ] Supabase Auth (Sign in with Apple + email)
- [ ] RevenueCat webhook → `accounts.entitlement`

### App
- [ ] Onboarding: level selection + adaptive placement test
- [ ] Session engine with the composition rules from doc 06
- [ ] FSRS scheduler, ported and tested against reference vectors
- [ ] Error classifier with the doc 06 taxonomy
- [ ] Bee playback controls: repeat, slow, definition, POS, sentence, origin
- [ ] Homophone rule: definition shown before the answer field enables
- [ ] **Autocorrect/paste lockdown + UI test** (doc 09)
- [ ] Near-miss diff feedback with per-pattern mnemonics
- [ ] Three age shells (K–2 tiles, 3–8 keyboard, HS/Adult keyboard)
- [ ] Stats: mastery map, streak, error-pattern summary
- [ ] Word of the Day + home screen and lock screen widgets
- [ ] Offline pack download
- [ ] Paywall with daily session metering
- [ ] Accessibility pass: dyslexia font, Dynamic Type, VoiceOver, reduce-motion
- [ ] Account deletion + data export

### Explicitly cut from v1
- Word uploads and photo/OCR import
- AI sentence generation as a live feature (pre-generate the bank instead)
- Parent dashboard and weekly email
- Oral bee mode
- Handwriting input
- Classroom tier
- Multiple voices

## v2 — Depth (~8 weeks after launch)

- [ ] **Photo/OCR import** — the feature parents ask for first
- [ ] Paste and CSV import, with enrichment and moderation (doc 08)
- [ ] AI sentence regeneration on demand, for paid users
- [ ] **Parent dashboard + weekly email report** — the retention feature
- [ ] Multiple child profiles and the family plan
- [ ] Targeted error-pattern drill mode as a first-class surface
- [ ] Confusables / homophone drill mode
- [ ] Second and third voices, with per-profile selection
- [ ] Achievements and streak repair

## v3 — Expansion

- [ ] Oral bee mode with constrained speech recognition
- [ ] Handwriting input for K–2
- [ ] Classroom tier: seat roster, class report, teacher-assigned lists
- [ ] Etymology and roots/affixes drills for HS/adult
- [ ] ESL band with L1-specific error patterns
- [ ] Opt-in adult leaderboards and weekly leagues
- [ ] iPad and Apple Watch (Watch for Word of the Day only)

## Dependencies and sequencing

```
Content sourcing ──────────────────┐
       │                           │
       ▼                           ▼
   Enrichment ──► TTS pre-gen ──► Pronunciation QA ──► Offline packs
                                                            │
Schema + RLS ──► Auth ──► Sync ─────────────────────────────┤
                                                            ▼
                          Session engine ──► Shells ──► Launch
                                 │
                    FSRS + Error classifier
```

Content is the critical path and the least parallelizable. Start it in week one,
before any app code, and staff it separately from engineering.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Word bank licensing challenged | Existential | WordNet base; `source`/`license` per row; counsel review before launch |
| TTS mispronunciations ship | Refunds, 1-star reviews | Mandatory human QA gate; `pronunciation_verified_at` enforced |
| Autocorrect grades wrong answers as correct | Product is broken | Lockdown + automated UI test (doc 09) |
| Free tier too generous / too thin | No conversion, or churn | Daily metering; instrument the paywall and iterate |
| Content cost overruns | Schedule slip | Fixed bank size; enrich in band order so a partial bank still ships |
| Grade bands mis-leveled | Frustration, churn | Placement test + quarterly rebanding from observed miss rates |
| COPPA retrofit needed | Weeks lost, SDK removal | Adult-account model and analytics choice decided before code (doc 10) |
