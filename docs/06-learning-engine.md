# 06 — Learning Engine

Two mechanisms carry the pedagogy: **when** a word comes back, and **what the
app learns from how it was misspelled**. The second is the differentiator.

## Scheduling: spaced repetition, not a missed-word bucket

The prototype's retest mode pulls words whose last result was wrong, and drops
them the moment they are answered right once. That is better than nothing and
worse than it looks: a word answered correctly on the same day it was missed has
not been learned, it has been remembered for ninety seconds.

Use **FSRS** (Free Spaced Repetition Scheduler). It is open source, well
documented, materially better than SM-2, and has reference implementations in
several languages that are straightforward to port to Swift.

State per `(profile, word)` lives in `review_state`: `stability`, `difficulty`,
`due_at`, `reps`, `lapses`.

### Grading an attempt

FSRS expects a four-point grade. Map spelling attempts like this:

| Grade | Condition |
| --- | --- |
| `Again` (1) | Incorrect, edit distance > 1 |
| `Hard` (2) | Incorrect with edit distance 1, **or** correct with a hint used, **or** correct after 3+ replays |
| `Good` (3) | Correct, first try, no hints |
| `Easy` (4) | Correct, first try, no hints, latency well under this profile's median |

The `Hard` row is where near-misses earn a shorter interval instead of being
thrown into the same bucket as a total miss. It matters — a one-letter slip and
a word the learner has never seen are not the same event.

### Mastery states

Surfaced to the user; `review_state.mastery`:

```
new ──► learning ──► review ──► mastered
                ▲                  │
                └────── lapsed ◄───┘
```

- **new** — never attempted
- **learning** — in the initial short-interval loop (same day, next day)
- **review** — graduated, interval ≥ 3 days
- **mastered** — interval ≥ 21 days with no lapse in the last 3 reps
- **lapsed** — a mastered or review word missed again; re-enters learning with
  reduced stability

Mastered words are not shown again until due, and mastered counts are the
headline stat for parents ("Maya has mastered 143 words").

### Session composition

A default 10-word session:

| Slots | Source |
| --- | --- |
| 4 | Due for review (`due_at <= now`, oldest first) |
| 3 | New words from the profile's band |
| 2 | Targeted drill on the profile's weakest error pattern |
| 1 | Word of the Day (if not already answered today) |

If there are more than 15 overdue words, suppress new words entirely until the
backlog is under control. Nothing kills a streak faster than a session that is
100% words the learner already knows they are failing.

Interleave rather than block: do not present all four review words first. Mixed
practice produces better retention than blocked practice, and it keeps the
session from feeling front-loaded with hard items.

## Error analysis

This is the feature no competitor does well, and it is what a subscription is
actually for. On every incorrect attempt, classify *how* the word was misspelled
and store the labels on `attempts.error_patterns`.

### Classifier

Align the submitted string against the target with a Damerau–Levenshtein
alignment (so transpositions are one operation, not two), then examine the edit
operations in the context of the target word's known patterns.

```
target:    n e c e s s a r y
submitted: n e c c e s a r y
                ^^^        ^
           doubled the wrong consonant
```

### Pattern taxonomy

| Pattern | Example | Detection |
| --- | --- | --- |
| `double_consonant` | `necesary`, `occassion` | Count mismatch on a doubled consonant run |
| `silent_e` | `hopeing`, `writting` | Trailing `e` dropped/kept incorrectly before a suffix |
| `ie_ei` | `recieve`, `beleive` | Transposition within an `ie`/`ei` digraph |
| `vowel_substitution` | `seperate`, `definate` | Single-vowel substitution, usually on a schwa |
| `plural_rule` | `babys`, `potatos` | `-y → -ies`, `-o → -oes`, `-f → -ves` violations |
| `suffix_doubling` | `runing`, `begining` | Final consonant not doubled before a vowel suffix |
| `silent_letter` | `nife`, `rithm` | Omission of a known silent grapheme (`kn`, `wr`, `gh`, `mb`, `ps`) |
| `homophone` | `their` for `there` | Submitted string is a valid word in the same `homophone_group` |
| `phonetic` | `fone`, `enuf` | Submission is phonetically plausible but orthographically wrong |
| `transposition` | `freind`, `recieve` | Adjacent character swap |
| `prefix` | `dissapoint`, `mispell` | Prefix boundary doubling error |
| `consonant_substitution` | `sertain`, `sity` | `c`/`s`/`k`, `g`/`j`, `f`/`ph` confusions |
| `typo` | Adjacent-key single substitution, latency very low | Excluded from pattern stats |

The `typo` category matters. A learner who typed `speling` because their thumb
missed does not have a double-consonant problem, and counting it as one poisons
the report. Use keyboard adjacency plus unusually fast latency to separate typos
from genuine errors, and exclude them from pattern aggregates while still
grading the attempt as incorrect.

`words.error_patterns` holds the patterns a word *exercises*, which is what
targeted drills select on. `attempts.error_patterns` holds the patterns a
learner *tripped on*, which is what the report aggregates.

### From patterns to action

Aggregate per profile over a rolling 30 days:

```sql
select unnest(error_patterns) as pattern, count(*) as misses
from attempts
where profile_id = $1
  and not correct
  and created_at > now() - interval '30 days'
group by 1
order by misses desc;
```

Then:

- **Tell the learner**, in plain language: "You've missed 7 words this month by
  not doubling a consonant before `-ing`. Want a 5-word drill?"
- **Fill the drill slots** in each session from words whose
  `words.error_patterns` overlap the top pattern
- **Put it in the parent report** — this is the sentence that renews the
  subscription

Require a minimum of 5 misses in a pattern before surfacing it. Below that it is
noise, and telling a parent their child has a problem based on two data points
destroys trust in the whole feature.

## Near-miss feedback

When an answer is wrong by one or two operations, do not just say "incorrect."
Show the submission with the divergence highlighted, then the correct spelling,
then name the rule:

```
You typed:   n e c [c] e s   a r y
Correct:     n e c   e s [s] a r y

One 'c', two 's'. Remember: "one collar, two sleeves."
```

Mnemonics can be authored per pattern (not per word) so the content cost is
bounded at a dozen or so.

## Hints

Hints are not free — they downgrade the FSRS grade to `Hard` and increment
`attempts.hints_used`. Offer, in escalating order:

1. Number of letters and syllables
2. First letter
3. The word with one vowel revealed
4. Reveal (counts as incorrect; the word returns tomorrow)

For K–2, hints should be more generous and carry no penalty — at that age the
goal is exposure, and a penalty structure teaches the child to avoid asking for
help.

## Anti-gaming

- Block paste into the answer field
- Disable autocorrect and spell-check (see doc 09 — this is the single most
  important correctness detail in the app)
- Cap replays per word at 10 and record the count
- Do not display the target word anywhere on screen before submission — including
  in an unmasked sample sentence
