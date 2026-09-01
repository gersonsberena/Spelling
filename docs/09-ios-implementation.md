# 09 — iOS Implementation

## The autocorrect trap

**This is the most important detail in the app.** iOS will silently correct a
misspelling into the correct word before your code ever sees it. A learner types
`recieve`, iOS submits `receive`, the app says "Correct!", and the app is now
worse than useless — it is confirming the error.

Every answer field must disable the entire text-assistance stack:

SwiftUI covers only part of this. These modifiers exist:

```swift
TextField("", text: $answer)
    .autocorrectionDisabled(true)
    .textInputAutocapitalization(.never)
    .keyboardType(.asciiCapable)   // avoids predictive/emoji row surprises
    .textContentType(.none)        // no AutoFill suggestion
```

`spellCheckingType`, `smartQuotesType`, `smartDashesType`, and
`smartInsertDeleteType` have **no SwiftUI equivalent** as of iOS 17. Each is an
independent route to a corrected string, so the answer field must be a
`UIViewRepresentable` wrapping `UITextField`:

```swift
struct AnswerField: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UITextField {
        let field = NoPasteTextField()
        field.autocorrectionType       = .no
        field.autocapitalizationType   = .none
        field.spellCheckingType        = .no
        field.smartQuotesType          = .no
        field.smartDashesType          = .no
        field.smartInsertDeleteType    = .no
        field.textContentType          = nil
        field.keyboardType             = .asciiCapable
        field.inlinePredictionType     = .no   // iOS 17+
        field.delegate                 = context.coordinator
        return field
    }
    // updateUIView / makeCoordinator omitted
}

final class NoPasteTextField: UITextField {
    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        if action == #selector(paste(_:)) { return false }
        return super.canPerformAction(action, withSender: sender)
    }
}
```

Reaching for `UIViewRepresentable` here is not premature — `autocorrectionType`
alone is not sufficient, and every one of the properties above is a way for the
system to hand you a spelling the learner did not produce.

Also required:

- **Block paste** — handled by `NoPasteTextField` above.
- **Reject a suspiciously fast, perfect answer** on a long word as a possible
  paste or dictation artifact; log it rather than blocking, and review the data.
- **Disable dictation** (`.keyboardType(.asciiCapable)` does not remove the mic
  key on all keyboards; use a custom input view for the K–2 shell where this
  matters most).

Write an automated UI test for this. It is exactly the kind of bug that is
reintroduced by a well-meaning refactor and not noticed for a month.

## Three age shells, one engine

The session engine, scheduler, and error analyzer are shared. Only the
presentation layer differs.

| | K–2 | Grades 3–8 | HS / Adult |
| --- | --- | --- | --- |
| Input | Letter tiles or handwriting | Keyboard | Keyboard |
| Timer | Never | Optional | Optional |
| Hints | Free, generous | Penalized | Penalized |
| Reward | Characters, sounds, stickers | XP, streak, mastery map | Mastery %, streak |
| Session length | 5 words | 10–20 | 10–30 |
| Leaderboard | Never | Never | Opt-in |
| Typography | Large, high contrast, dyslexia font default-available | Standard | Standard |

Implement as a `SessionShell` protocol with three SwiftUI conformances selected
from `profile.level`. Resist the urge to branch inside one view — the shells
diverge enough that conditionals will become unreadable within a month.

## Input modes

### Letter tiles (K–2)

A scrambled set of the word's letters plus two or three distractors, tapped in
order. Removes typing ability as a confound — a 6-year-old's spelling knowledge
should not be gated on their ability to find keys on a glass keyboard.

Record `input_mode = 'tiles'` on the attempt; tile answers are not directly
comparable to typed answers for difficulty estimation.

### Handwriting (K–2, optional)

`PencilKit` canvas + `VNRecognizeTextRequest` in handwriting mode. Closer to how
spelling is actually assessed and practiced at that age, and genuinely delightful
with an Apple Pencil.

Recognition on children's handwriting is imperfect. Always show the recognized
text and offer "that's not what I wrote" before grading, and never let a
recognition failure count as a spelling error.

### Voice / oral bee mode (paid)

The learner spells the word out loud, letter by letter, as in an actual bee.
`SFSpeechRecognizer` with a constrained vocabulary — you are recognizing 26
letter names, which is a far easier problem than open dictation and works
acceptably on children's voices.

Handle the letter-name ambiguities explicitly: `a`/`eh`, `e`/`ee`, `i`/`eye`,
`u`/`you`, `b`/`be`/`bee`, `c`/`see`/`sea`, `y`/`why`. Build the constrained
grammar accordingly.

Gate behind a mic permission request that is asked in context, and provide a
typed fallback always.

## Accessibility

Not optional, and a genuine competitive advantage in this category:

- **Dyslexia-friendly font option** — Lexend or OpenDyslexic, selectable per
  profile. The overlap between "needs spelling practice" and "dyslexic" is large.
- **Dynamic Type** throughout, tested at the largest accessibility sizes
- **VoiceOver** labels on every control; the app is already audio-first, so this
  is mostly correct labeling rather than new work
- **Adjustable speech rate** independent of the slow-replay control
- **High contrast** and reduced-motion honoring (`accessibilityReduceMotion`
  should disable confetti and card animations)
- **Color-independent feedback** — correct/incorrect must not rely on green/red
  alone; use icons and text

## Local persistence

SwiftData models mirroring doc 04:

```
Profile, CachedWord, AudioIndexEntry, Attempt, ReviewState, StreakState, PackManifest
```

`Attempt` rows carry a `syncedAt: Date?`. The sync task pushes `syncedAt == nil`
rows in batches keyed by the client-generated UUID, so a retry after a partial
failure is idempotent.

Scheduling reads only local `ReviewState`, so starting a session never awaits the
network.

## Widgets

- **WidgetKit** small + medium for Word of the Day (doc 07)
- Share data with the app via an **App Group** container; the widget must render
  from cached data with no network
- Pre-generate a week of Word of the Day entries so the widget is correct offline
- `Link` destination deep-links into the quiz for that word

## StoreKit

RevenueCat's SDK, with a paywall that:

- Appears only after demonstrated value (doc 01)
- Is behind a **parental gate** when the active profile is a child (doc 10)
- Presents annual first with the trial, monthly second
- Includes Restore Purchases — Apple rejects builds without it

## Performance targets

| Interaction | Budget |
| --- | --- |
| App launch to session start | < 1.5 s cold |
| Tap "hear the word" to audio | < 100 ms (local file) |
| Answer submit to feedback | < 50 ms (all local) |
| Pack download, 1,500 words | < 3 min on Wi-Fi |

Everything in the session loop is local, so anything slower than these numbers is
a bug rather than a network condition.

## Testing

- Unit tests for the error classifier against a fixture set of real
  misspellings — this is the component most likely to regress silently
- Unit tests for the FSRS port against the reference implementation's vectors
- UI test asserting autocorrect cannot rescue a misspelling
- Snapshot tests for all three shells at the largest Dynamic Type size
- A manual pronunciation QA pass is a release gate, not a test
