# 07 — Gamification & Retention

Gamification here has one job: get the learner to open the app tomorrow. It
should never distort *what* is practiced — a scoring system that rewards easy
words will produce a user who only does easy words.

## Streaks

The strongest retention mechanic in this category, and the most common cause of
churn when handled badly. A broken streak is the moment people quit.

- A day counts when the profile's daily goal is met (default 10 words attempted,
  configurable 5–30)
- **Streak freezes**: 2 available, regenerating one per week of activity,
  auto-applied on a missed day. Do not make the user remember to equip one.
- **Streak repair**: within 48 hours, offer to restore a broken streak by
  completing a double session. Free, once a month.
- Show the streak on the widget and in the notification, not just in-app

Never send a guilt notification ("Your streak is about to die!") to a child
profile. Send it to the parent instead, framed as a reminder, or not at all.

## Mastery map, not a leaderboard

For children, a leaderboard compares a struggling speller to a strong one every
single day. It demotivates exactly the user who most needs to return.

Use a **mastery map**: a visual board of the current band's words, filling in as
words graduate. Progress is against the material, not against other people. It
also communicates something true — "142 of 400 words in Grade 3" — which is what
a parent wants to see.

Leaderboards are acceptable for **adult and high-school profiles only**, opt-in,
and never for under-13 profiles (see doc 10).

## XP and levels

- XP per correct word, weighted by the word's difficulty band and the FSRS grade
- **No XP for a word answered with a reveal hint** — otherwise revealing becomes
  the optimal strategy
- Bonus XP for clearing the overdue review queue, which aligns the reward with
  the behavior the learning engine actually wants
- Levels are cosmetic; they unlock themes, voices, and mastery-map skins, never
  content

## Achievements

Keep the list short and specific. Twenty achievements people can name beat two
hundred nobody reads.

| Achievement | Trigger |
| --- | --- |
| First Word | First correct answer |
| Perfect Ten | 10/10 in a session |
| Comeback | Master a word that had lapsed twice |
| Rule Breaker | Clear a full error-pattern drill with no misses |
| Bee Ready | 50 words mastered in the bee word list |
| Week Strong / Month Strong | 7- / 30-day streak |
| Homophone Hunter | 20 confusable pairs mastered |
| Early Bird | 10 sessions before 9am |

The Comeback and Rule Breaker achievements reward the hard, valuable behavior
rather than volume.

## Word of the Day

The retention lever, and it must live **outside the app** to work.

- One word per band per day, chosen from words slightly above the profile's
  current level (interesting, not crushing), pre-generated a week ahead so the
  widget works offline
- **Home-screen widget** (WidgetKit, small and medium): the word, its part of
  speech, and a tap target that opens straight into the quiz for it
- **Lock Screen widget**: word and streak count
- Answering the Word of the Day counts toward the daily goal
- Free tier gets Word of the Day every day, forever — it is the app's daily
  advertisement for itself

Widgets are the highest-leverage retention work available on iOS and are
routinely skipped. Do not skip them.

## Notifications

| Notification | Timing | Audience |
| --- | --- | --- |
| Word of the Day ready | User-chosen time, default 4pm | All |
| Streak reminder | 8pm if goal not met | Adults; parent for child profiles |
| Review queue due | When ≥ 10 words are overdue, max 2×/week | All |
| Weekly report ready | Sunday morning | Parent only |

Cap at one notification per day. Ask for permission *after* the first completed
session, never on launch — permission asked at launch is permission denied.

## Session-level feedback

- Immediate per-word feedback with the near-miss diff (doc 06)
- End-of-session summary: score, XP, streak, words that graduated to mastered,
  and a single named takeaway ("Double consonants tripped you up twice")
- One-tap "Retest the ones I missed" — already present in the prototype and
  worth keeping exactly as it is

## Age-appropriate tone

| Band | Reward style |
| --- | --- |
| K–2 | Animated characters, sounds, stickers, no numbers, no timers |
| 3–8 | XP, streaks, mastery map, achievements, optional timed mode |
| HS / Adult | Mastery %, streak, clean stats, no characters, no confetti |

Adults abandon apps that treat them like children. The reward layer should be a
themeable surface over the same engine, not three different engines.
