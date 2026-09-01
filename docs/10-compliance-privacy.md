# 10 — Compliance & Privacy

Serving children changes the rules for analytics, accounts, advertising, and
purchase flows. Decide the posture before building, because retrofitting COPPA
compliance means removing SDKs and deleting data.

> This document is engineering guidance, not legal advice. Have counsel review
> the privacy policy and the Kids Category decision before submission.

## The account model that solves most of this

**Adults hold accounts. Children hold profiles.**

- Only an adult creates an account, with an email address
- Child learners exist as `profiles` rows under that account, with a display name
  and a birth *year* — never a full date of birth, never an email, never a photo
- A child never authenticates, never has a login, and never supplies personal
  information to the app

This single decision removes the need for verifiable parental consent for account
creation, keeps children's personal data out of the system entirely, and gives
you the family plan for free.

## COPPA

Applies to children under 13 in the US. The practical requirements:

| Requirement | How this app satisfies it |
| --- | --- |
| No collection of personal info from children | Profiles store a name and birth year, supplied by the parent |
| No behavioral advertising | No ads at all |
| No third-party tracking SDKs | See "Analytics" below |
| Parental consent for data collection | The parent creates the account and the profiles |
| Data deletion on request | Delete the account, cascade to profiles, attempts, everything |
| Data minimization | Do not collect what the product does not need |

**Do not collect**: precise location, contacts, photos (OCR is on-device and the
image is never uploaded), microphone recordings (speech recognition is on-device
and audio is not retained), device advertising identifiers.

## App Store Kids Category

Opting into the Kids Category (Apple Review Guideline 1.3 and 5.1.4) is a real
choice with costs:

**If you opt in:**
- No third-party analytics or advertising SDKs, at all
- No links out of the app without a parental gate
- Purchases require a parental gate
- Higher review scrutiny, longer review cycles

**If you do not opt in** but the app is clearly for children, Apple will still
apply many of these expectations, and you lose the Kids Category placement.

**Recommendation:** ship in Education, not Kids Category, with a clear "designed
for families" positioning and full COPPA compliance anyway. This keeps the
adult and high-school audiences addressable — a Kids Category app cannot
comfortably serve adult professional vocabulary — while keeping children safe.
Revisit if a kids-focused SKU makes sense later.

Either way, set the App Store age rating honestly and complete the App Privacy
nutrition label accurately. Mismatches there are a common rejection.

## Parental gates

Required before: any purchase flow, any external link, any settings that affect
billing, and account deletion.

Apple's guidance is that the gate must not be solvable by a young child. Use a
math problem in words:

```
"What is seven plus four?"   [ text entry, digits ]
```

Not a slider, not "tap and hold" — those are patterns Apple has specifically
rejected. Regenerate the question each time.

## Analytics

The compliance-safe options:

| Option | Notes |
| --- | --- |
| **TelemetryDeck** | Privacy-first, no identifiers, COPPA-friendly, hosted in the EU |
| **Self-hosted PostHog** | Full control, more operational work |
| **First-party events into Supabase** | Simplest; you already have the database |

Do **not** use Firebase Analytics, Amplitude, Mixpanel with default settings, or
any ad-attribution SDK in a build children use. For crash reporting, use MetricKit
and Xcode Organizer rather than a third-party crash SDK.

Aggregate analytics on child profiles only. Never send a child's display name,
their answers, or their word-level performance to any third party.

## Data retention and deletion

- **Account deletion must be available in the app** (Apple requires this for any
  app that supports account creation). One tap, behind a parental gate, with a
  clear warning.
- Deletion cascades: `accounts → profiles → sessions → attempts → review_state →
  streaks → uploads`, and removes user-uploaded audio from Storage.
- Retain attempt data indefinitely while the account lives — it is the learning
  record and deleting it breaks the product. Say so plainly in the privacy policy.
- Offer a data export (JSON) for the account's profiles. Cheap to build, good for
  GDPR, and reassuring to parents.

## GDPR / UK

If shipping in the EU or UK:

- Lawful basis: contract (for the service) and consent (for optional email
  reports)
- Age of digital consent varies by member state (13–16); the adult-account model
  handles this
- Data export and deletion, both covered above
- A DPA with Supabase, Cartesia, and the LLM provider
- Note in the privacy policy that uploaded words and generated sentences are
  processed by third-party APIs, and name them

## Third-party data flow disclosure

Be specific in the privacy policy about what leaves the device:

| Data | Goes where | When |
| --- | --- | --- |
| Answers, session results | Supabase | Always (sync) |
| Uploaded word lists | Supabase, then LLM + Cartesia | Paid import only |
| Photo of a word list | **Nowhere** — OCR is on-device | Never uploaded |
| Voice audio (bee mode) | **Nowhere** — recognition is on-device | Never uploaded |
| Email address | Supabase, email provider | Account holder only |

The two "nowhere" rows are worth stating loudly in the App Store description.
Parents notice.

## Content safety

- Age-gate words whose definitions are inappropriate for young learners
  (`words.age_gated`, doc 02)
- Moderate all generated and uploaded text (doc 08)
- No user-to-user communication of any kind in v1 — it is the largest child-safety
  surface available and the product does not need it
