# 01 — Monetization

## The problem with "free gets fewer words"

Capping the vocabulary ceiling makes the free tier feel *broken* rather than
*small*. A user who hits a permanent wall on day two churns; they do not
convert. Broken free tiers produce uninstalls, not subscriptions.

Meter **sessions per day**, not lifetime vocabulary. A free user should be able
to have a complete, satisfying five minutes every single day, and should hit the
limit only when they want *more today*. That is the moment a subscription makes
sense to them.

## Tiers

| Capability | Free | Paid |
| --- | --- | --- |
| Word of the Day (+ widget) | ✅ | ✅ |
| Practice sessions | 1 session/day, up to 10 words | Unlimited |
| Word bank | Full grade-band bank | Full bank + all bands |
| Text to speech | ✅ standard voice | ✅ + voice choice, speed control |
| Definition & part of speech | ✅ | ✅ |
| Example sentence | Curated sentence only | Curated + AI-generated, regenerate on demand |
| Missed-word retest | ✅ | ✅ |
| Spaced repetition scheduling | ✅ | ✅ |
| Error-pattern analysis | Summary only | Full breakdown + targeted drills |
| Stats history | Last 7 days | Unlimited |
| Import your own words | ❌ | ✅ (paste, CSV, photo/OCR) |
| Offline word + audio packs | ❌ | ✅ |
| Child profiles | 1 | Up to 6 |
| Parent/teacher weekly report | ❌ | ✅ |
| Bee practice mode (oral) | ❌ | ✅ |

Spaced repetition and the missed-word queue stay free deliberately. They are
what make the app *work*; gating them means the free tier does not demonstrate
the product's actual value, and the paywall then has nothing to sell against.

## Pricing

| Plan | Price | Notes |
| --- | --- | --- |
| Monthly | $6.99 | Impulse tier |
| Annual | $39.99 | ~52% discount; lead with this |
| Family (6 profiles) | $59.99/yr | Same features, more profiles — cheap to serve, high LTV |
| Classroom (30 seats) | $199/yr | Teacher-purchased, invoice or App Store |

Offer a **7-day free trial on annual only**. Trials on monthly cannibalize; on
annual they convert.

The classroom tier is the highest-margin line and the least crowded. One teacher
purchase equals roughly thirty consumer months at a fraction of the acquisition
cost. It needs almost nothing consumer does not already need — a seat roster and
a class report — but it should not delay v1.

## Paywall placement

Show the paywall at moments of demonstrated value, not on launch:

1. After the **second completed session** in a day (the daily limit hit)
2. When tapping **Import words** or **Photo import**
3. When tapping **Regenerate sentence** (AI feature)
4. On the stats screen when scrolling past 7 days of history
5. When adding a **second child profile**

Never show a hard paywall before the user has completed one session. Never show
a paywall to a child without a parental gate in front of it — see
[10 — Compliance & Privacy](10-compliance-privacy.md).

## Implementation

Use **RevenueCat**. StoreKit 2 is manageable but receipt validation, grace
periods, billing retry, promotional offers, cross-platform entitlement, and
subscription-status webhooks are weeks of work that RevenueCat provides on day
one. Entitlements should be checked server-side (via RevenueCat webhook →
Supabase `profiles.entitlement`) for anything that costs money to serve — AI
sentence generation and TTS for uploaded words in particular. A client-side
entitlement check is a suggestion, not a gate.

## Cost per paid user (rough)

| Line item | Monthly cost |
| --- | --- |
| Cartesia TTS | ~$0 steady state (pre-generated and cached; see doc 05) |
| LLM sentence generation | < $0.02 (cached per word, not per request) |
| Supabase (db + storage + egress) | < $0.05 |
| RevenueCat | Free under $2.5k MTR, then 1% |
| Apple's cut | 30% (15% after year one, or immediately under Small Business Program) |

Serving cost is negligible; the economics are dominated by Apple's cut and
acquisition. That argues for the annual and family plans, and for the classroom
tier where acquisition cost per seat collapses.
