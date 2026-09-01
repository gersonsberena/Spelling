# 02 — Word Bank & Content

The word bank is the product. The app around it is commodity; a bad word bank
cannot be rescued by good software. Budget for it accordingly — this is the
single largest non-engineering line item.

## Licensing: do not scrape a dictionary

> The prototype's `.gitignore` already excludes `source/` and `wordlist.csv` as
> "copyrighted spelling-bee source material." That instinct is correct, and it
> is also the problem: content that cannot be committed cannot be shipped in a
> paid app either. The bank has to be rebuilt on sources that are licensed for
> commercial use before launch.

Dictionary definitions are copyrighted. Scraping Merriam-Webster, Dictionary.com,
or the Oxford corpus and shipping it in a paid app is a real legal exposure, not
a theoretical one.

Viable sources:

| Source | License | Good for | Caveat |
| --- | --- | --- | --- |
| **WordNet** (Princeton) | Permissive, commercial OK | Definitions, part of speech, sense relations | Terse, academic register; needs rewriting for children |
| **Wiktionary** | CC BY-SA 3.0 | Definitions, etymology, IPA pronunciation | Attribution **and** share-alike required — see below |
| **Merriam-Webster API** | Paid commercial license | Authoritative definitions, audio | Costs money, rate-limited, worth it for a flagship tier |
| **Scripps school lists** | Published for study | Grade-band membership | Word lists only, not definitions |
| **Dolch / Fry lists** | Public domain | K–3 sight words | Word lists only |
| **Academic Word List (Coxhead)** | Free for educational use | Adult/academic band | Check terms for commercial use |
| **SUBTLEX-US / Google Ngram** | Free | Frequency bands for difficulty scoring | Frequency data only |

**Recommended path:** WordNet as the definition base (permissive, no share-alike
problem), Wiktionary for IPA and etymology where WordNet has none, an LLM pass to
rewrite definitions to a target reading level, then human spot-checking. Keep a
`source` and `license` column on every row so an attribution page can be
generated and so a source can be swapped out later without re-auditing the bank.

CC BY-SA share-alike is the trap: if a definition is a derivative of Wiktionary
text, that definition must be released under CC BY-SA. That is survivable if you
segregate those rows and publish them, but it is much simpler to build the
definition layer on WordNet and use Wiktionary only for facts that are not
copyrightable (IPA, language of origin).

## Grade leveling

Do not hand-assign difficulty. Score each word on four signals and bucket:

1. **Published list membership** — Dolch, Fry, Scripps grade lists. Strongest signal; use it directly where it exists.
2. **Frequency band** — SUBTLEX-US log frequency. Rare words are harder.
3. **Orthographic complexity** — syllable count, letter count, presence of known-hard patterns (silent letters, `ough`, `ie/ei`, doubled consonants, Greek `ph`/`ch`, schwa in an unstressed syllable).
4. **Observed miss rate** — once there is traffic, the app's own data outranks all of the above. Recompute bands quarterly.

Bands to ship, as a `level` enum rather than an integer (the prototype's
`grade_level integer` cannot express "adult" or "SAT"):

```
grade_1, grade_2, grade_3, grade_4, grade_5, grade_6, grade_7, grade_8,
high_school, sat_act, adult_general, adult_professional, esl_foundation
```

Words belong to **many** bands, so the relationship is many-to-many via a
`word_list_items` join table, not a column on `words`.

## Required fields per word

| Field | Why |
| --- | --- |
| `word` | — |
| `part_of_speech` | Bee format; also disambiguates homographs |
| `definition` | Bee format; required for homophones |
| `definition_reading_level` | So a 2nd grader is not read a college definition |
| `sample_sentence` | Bee format; must not contain the word's spelling visually when read aloud |
| `ipa` | Pronunciation QA and "language of origin" features |
| `tts_override_text` | Forces correct synthesis when the engine mispronounces (see doc 05) |
| `language_of_origin` | Bee affordance, etymology drills |
| `homophone_group` | Nullable; words sharing a value are audio-ambiguous |
| `syllables` | Difficulty scoring, hint system |
| `error_patterns[]` | Which spelling rules this word exercises (see doc 06) |
| `frequency_rank` | Difficulty scoring |
| `source`, `license` | Attribution and auditability |

## Homophones are a correctness bug, not an edge case

`their / there / they're` cannot be answered from audio alone. Neither can
`principal / principle`, `to / too / two`, `bear / bare`. This is precisely why
real spelling bees give a definition and a sentence.

Rules:

- Any word with a non-null `homophone_group` **must** display its definition and
  part of speech before the answer field is enabled. Audio alone is never
  sufficient.
- The sample sentence for a homophone must disambiguate. "I put it over *there*"
  works; "I saw *there* dog" is both wrong and useless.
- Ship a dedicated **Confusables drill** mode. It is a genuinely wanted feature
  for adults and it turns the hardest content problem into a selling point.

## Sample sentences must not leak the answer

A sentence is read aloud, so it may contain the word. But if the sentence is
ever *displayed* as text, it must have the target word masked (`I went to the
______ yesterday`). Store sentences with the target word delimited so masking is
mechanical rather than a string search — a naive search breaks on inflections.

## Pronunciation QA

Every word needs its synthesized audio listened to by a human before it ships.
TTS engines mispronounce rare words, proper nouns, and anything with irregular
stress; a wrong pronunciation in a spelling app produces a wrong answer the user
cannot possibly have avoided, and that is a refund and a one-star review.

Process:

1. Batch-synthesize the band
2. Auto-flag suspects: words with low frequency rank, words whose IPA has
   irregular stress, words containing known-hard graphemes
3. Human listens to all flagged words plus a 10% random sample of the rest
4. Failures get a `tts_override_text` (respelling or phoneme markup) and are
   re-synthesized and re-checked

Track a `pronunciation_verified_at` timestamp per word. Never serve an
unverified word to a paid user.

## Content safety

The bank will be used by children. Beyond obvious profanity, screen for words
whose definitions reference violence, sexual content, or self-harm — WordNet
contains plenty of clinical vocabulary that is inappropriate to serve to a 2nd
grader with its definition attached. Maintain an `age_gated` flag and filter by
the profile's band, not just by word difficulty.

## Target bank size for v1

| Band | Words |
| --- | --- |
| Grades 1–2 | 400 |
| Grades 3–5 | 1,200 |
| Grades 6–8 | 1,500 |
| High school / SAT | 1,500 |
| Adult general + professional | 1,200 |
| **Total** | **~5,800** |

That is enough that no user exhausts it, and small enough to fully QA and to
pre-render audio for at a trivial cost.
