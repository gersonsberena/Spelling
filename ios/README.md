# iOS

## `SpellingCore`

A Swift package holding the parts of the app that are pure logic — the spaced
repetition scheduler, the attempt grader, and the error classifier. No SwiftUI,
no UIKit, no networking, so it builds and tests anywhere Swift runs.

```sh
cd ios/SpellingCore
swift test
```

**Run this first.** It was written in an environment with no Swift toolchain, so
while the logic is verified (see below), the code itself has never been
compiled. Anything that fails will be a syntax or API slip, and the test suite
pins the behavior so fixing one is fast.

```
Sources/SpellingCore/
  FSRS.swift             FSRS-6 core math, Rating, Mastery, ReviewState
  Grader.swift           attempt -> FSRS grade, and mastery state transitions
  ErrorClassifier.swift  how a word was misspelled, as sorted ErrorPatterns
Tests/SpellingCoreTests/
  Vectors/               shared test vectors — generated, do not hand-edit
  FSRSVectorTests.swift
  ErrorClassifierVectorTests.swift
```

### How this is verified without a Mac

The vectors are the point. `Vectors/fsrs.json` carries 172 cases recorded from
the **actual reference implementation** —
[py-fsrs](https://github.com/open-spaced-repetition/py-fsrs), MIT — covering
every branch of the core math, plus multi-review sequences, grade mappings, and
mastery transitions.

```
py-fsrs  ──recorded──>  fsrs-reference.json  ──asserted by──>  pipeline/lib/fsrs.mjs
                                │
                                └──exported──>  Vectors/fsrs.json  ──asserted by──>  FSRS.swift
```

So passing `swift test` means agreeing with the real FSRS algorithm, not merely
with our JavaScript. The classifier vectors work the same way, with the
JavaScript implementation as the reference — if Swift and JavaScript ever
disagree, one of them is wrong, and reports computed on device would drift from
reports computed on the server.

Regenerate after changing either implementation:

```sh
npm run vectors      # from the repo root
```

### Why FSRS and not the prototype's retest-missed

The web prototype drops a word from the retest list as soon as it is answered
correctly once. A word answered right on the day it was missed has not been
learned, it has been remembered for ninety seconds. FSRS schedules it to return
tomorrow, then in three days, then a week — and `Grader` maps a one-letter slip
to `hard` rather than `again`, so a near miss earns a shorter interval instead
of being thrown in with words the learner has never seen.

## Not built yet

The app target itself — SwiftUI shells, Supabase client, audio playback,
widgets. `docs/09-ios-implementation.md` covers the design, including the
autocorrect lockdown that has to be a `UIViewRepresentable` because
`spellCheckingType` and friends have no SwiftUI equivalent.
