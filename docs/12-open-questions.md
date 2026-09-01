# 12 — Open Questions

Decisions that need an owner before the corresponding work starts. Each one
changes the build materially, so leaving them open is expensive.

## Blocking v1

**1. Kids Category, or Education with family positioning?**
Doc 10 recommends Education. This decides whether third-party analytics are
possible at all, and it must be settled before the analytics SDK is chosen.
*Owner: product. Needed by: week 1.*

**2. Definition source — WordNet, or a paid dictionary license?**
WordNet is free and permissive but terse and needs rewriting. A Merriam-Webster
license costs money and buys authority plus reference audio. This determines the
content budget and the enrichment pipeline.
*Owner: product + legal. Needed by: week 1.*

**3. Is the LLM rewrite of sourced definitions a derivative work?**
Rewriting a WordNet definition to a 3rd-grade reading level is almost certainly
fine. Rewriting a copyrighted definition is not. Confirm before the enrichment
pipeline runs on anything but WordNet.
*Owner: legal. Needed by: week 2.*

**4. Which six bands ship at launch?**
Doc 02 proposes grades 1–8 collapsed into three ranges plus HS/SAT and two adult
bands. Every additional band is ~1,000 words of sourcing, enrichment, synthesis,
and QA. Cutting to four bands saves roughly three weeks.
*Owner: product. Needed by: week 1.*

**5. Cartesia phoneme/IPA control — what does the current API actually support?**
Doc 05 assumes overrides can be expressed as respellings and, ideally, as
phonemes. Verify against the current API reference before designing the override
workflow. If only plain-text respelling is available, QA effort goes up.
*Owner: engineering. Needed by: week 2.*

**6. Placement test design.**
How many words, what adaptive rule, and what happens when the result strongly
contradicts the parent's grade selection — silently adjust, or ask? Silently
adjusting risks a parent seeing "1st grade" content for their 3rd grader and
uninstalling.
*Owner: product + learning design. Needed by: week 4.*

## Blocking v2

**7. How much does upload enrichment cost in practice?**
Depends on the dedupe hit rate against the existing bank — school lists are
mostly common words, so the hit rate should be high, but that is an assumption.
Measure with a sample of real lists before setting the paid tier's import limits.

**8. Parent report: email, in-app, or both?**
Email drives re-engagement but requires an email provider, deliverability work,
and unsubscribe handling. In-app only is simpler and much weaker.

**9. Classroom tier billing — App Store or invoice?**
Schools generally cannot buy via the App Store. Invoicing means a web checkout, a
seat-management console, and a sales motion. This may be a separate product
rather than a tier.

## Product questions worth resolving early

**10. Does the free tier include the missed-word queue across days?**
Doc 01 says yes — spaced repetition stays free because it is what demonstrates
the value. Confirm, because the alternative (gating it) is a materially different
funnel.

**11. What happens when a learner exhausts a band?**
Auto-promote to the next band, offer the choice, or surface a "mastered" state
and stop? Most likely: offer, with the mastery map showing the accomplishment.

**12. Should adults see the streak mechanic at all?**
Adult users churn on gamification that feels juvenile, but streaks work on
adults in every other category. Probably keep streaks, drop XP and achievements,
per doc 07.

**13. Sibling profiles — shared or separate streaks?**
Separate is obviously correct pedagogically and creates a rivalry parents may or
may not want. Ship separate.

## Technical questions

**14. SwiftData or GRDB?**
SwiftData is cleaner and less code; its migration story has been rough. The
attempt log and review state are simple enough for either. Decide before the
persistence layer is written, not after.

**15. Where does FSRS run — device, server, or both?**
Doc 03 says device (so sessions never block on the network) with a server-side
recompute as a cross-check. Confirm that the two implementations can be kept in
agreement, or accept the device as authoritative and have the server only
aggregate.

**16. Offline pack size ceiling.**
~70 MB per band per voice is the estimate. If that is too large for the target
audience's devices, options are lower-bitrate audio, word-clips-only packs
(dropping definition and sentence audio), or on-demand fetch with a small
prefetch window.
