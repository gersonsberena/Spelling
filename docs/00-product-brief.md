# 00 — Product Brief

## One-line

A spelling app that runs a real spelling-bee format — hear the word, ask for the
definition, part of speech, and a sentence — and adapts to the learner from 1st
grade through adult professional vocabulary.

## Who it is for

Four distinct audiences that share a core loop but need different surfaces:

| Segment | Buyer | Motivation | Session shape |
| --- | --- | --- | --- |
| K–2 | Parent | Learning to spell at all | 5–10 words, tiles or handwriting, no timer |
| Grades 3–8 | Parent, sometimes teacher | Weekly class list, bee prep | 10–20 words, gamified |
| High school | Student, parent | SAT/ACT vocabulary, bee competition | 20+ words, etymology, timed option |
| Adult | Self | Professional writing, ESL, self-improvement | 10–20 words, no cartoons, mastery % |

The **buyer and the user are different people** in three of four segments. That
shapes everything: the parent needs visible proof of progress, the child needs
the loop to be fun, and the paywall has to be legible to the parent while sitting
behind a parental gate.

## Positioning

Existing apps mostly do "type the word you hear." That format is broken for
homophones, gives no reason to prefer one app over another, and teaches
recognition rather than spelling.

Three things differentiate this product:

1. **The real bee format.** Definition, part of speech, sentence, language of
   origin, repeat, slow down. This is how spelling is actually assessed and
   taught, and it makes homophones answerable.
2. **Error analysis, not right/wrong.** The app classifies *how* a word was
   misspelled — doubled consonant, silent e, ie/ei, plural rule, vowel
   substitution — and drills the pattern, not just the word. See
   [06 — Learning Engine](06-learning-engine.md).
3. **Parent visibility.** A weekly report naming the specific patterns a child
   is struggling with. This is what converts and retains the person holding the
   credit card.

## What the app does

- Onboarding picks an age/grade band, then runs a short adaptive placement test
  so the band is a starting hypothesis rather than a permanent setting
- Each word is presented with audio (Cartesia), definition, and part of speech;
  a sentence is available on request
- The learner types (or writes, or taps letter tiles) the word
- Missed words enter a spaced-repetition queue and return on a schedule
- Stats, streaks, mastery levels, and a Word of the Day widget drive return visits
- Paid users import their own lists (photograph the school's list), get
  AI-generated sentences, full history, offline packs, and multiple profiles

## Non-goals

- Not a general vocabulary or reading app. Spelling is the wedge; vocabulary
  features exist only where they serve spelling (roots, affixes, etymology).
- Not a social network. Leaderboards, if any, are opt-in and adults-only.
- Not a school LMS integration in v1. Classroom seats yes, rostering no.

## Success measures

| Measure | Target for a healthy v1 |
| --- | --- |
| D1 retention | > 40% |
| D7 retention | > 20% |
| Free → paid conversion | 3–6% |
| Sessions per active week | 3+ |
| Words graduated to "mastered" per active user per week | 8+ |

The last one is the honest one. Retention without learning is a treadmill; if
words are not graduating, the learning engine is wrong regardless of the other
numbers.
