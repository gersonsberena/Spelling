import Foundation

/// A spelling rule a learner tripped on. Slugs match `attempts.error_patterns`
/// in the database and the taxonomy in `docs/06-learning-engine.md`.
public enum ErrorPattern: String, Codable, Sendable, CaseIterable, Comparable {
    case consonantSubstitution = "consonant_substitution"
    case doubleConsonant = "double_consonant"
    case homophone
    case ieEi = "ie_ei"
    case phonetic
    case pluralRule = "plural_rule"
    case prefix
    case silentE = "silent_e"
    case silentLetter = "silent_letter"
    case suffixDoubling = "suffix_doubling"
    case transposition
    case typo
    case vowelSubstitution = "vowel_substitution"

    public static func < (a: ErrorPattern, b: ErrorPattern) -> Bool {
        a.rawValue < b.rawValue
    }
}

public struct Classification: Sendable, Equatable {
    public let correct: Bool
    public let editDistance: Int
    /// Always sorted, so two runs and two languages agree exactly.
    public let patterns: [ErrorPattern]
}

/// Classifies *how* a word was misspelled, not merely whether it was.
///
/// This is what a targeted drill and a parent report are built on: knowing a
/// learner misses double consonants is worth far more than knowing they missed
/// "necessary". Kept deterministic and locale-free so the Swift and JavaScript
/// implementations agree — they are validated against shared vectors.
public enum ErrorClassifier {

    public struct Context: Sendable {
        /// Other spellings sharing this word's homophone group.
        public var homophones: [String]
        public var latencyMs: Double?
        public var medianLatencyMs: Double?

        public init(
            homophones: [String] = [],
            latencyMs: Double? = nil,
            medianLatencyMs: Double? = nil
        ) {
            self.homophones = homophones
            self.latencyMs = latencyMs
            self.medianLatencyMs = medianLatencyMs
        }
    }

    public static func classify(
        target: String,
        submitted: String,
        context: Context = Context()
    ) -> Classification {
        let t = normalize(target)
        let s = normalize(submitted)

        if t == s {
            return Classification(correct: true, editDistance: 0, patterns: [])
        }

        let distance = damerauLevenshtein(t, s)

        // A homophone substitution is a meaning error, not an orthography one,
        // and is the single case where the learner may have spelled a real word
        // perfectly. Reported alone.
        if context.homophones.map(normalize).contains(s) {
            return Classification(correct: false, editDistance: distance, patterns: [.homophone])
        }

        // A thumb slip is not a spelling problem. Counting it as one poisons the
        // parent report, so it is reported alone and excluded from aggregates.
        if isTypo(t, s, distance: distance, context: context) {
            return Classification(correct: false, editDistance: distance, patterns: [.typo])
        }

        var found = Set<ErrorPattern>()

        if isTransposition(t, s) {
            found.insert(.transposition)
            if containsIeEi(t) && containsIeEi(s) { found.insert(.ieEi) }
        }
        if doubledRuns(t) != doubledRuns(s) { found.insert(.doubleConsonant) }
        if suffixDoublingError(t, s) { found.insert(.suffixDoubling) }
        if silentEError(t, s) { found.insert(.silentE) }
        if pluralRuleError(t, s) { found.insert(.pluralRule) }
        if silentLetterError(t, s) { found.insert(.silentLetter) }
        if prefixBoundaryError(t, s) { found.insert(.prefix) }

        if let sub = singleSubstitution(t, s) {
            let fromVowel = vowels.contains(sub.from)
            let toVowel = vowels.contains(sub.to)
            if fromVowel && toVowel {
                found.insert(.vowelSubstitution)
            } else if !fromVowel && !toVowel {
                found.insert(.consonantSubstitution)
            }
        }

        if found.isEmpty && soundsAlike(t, s) { found.insert(.phonetic) }

        return Classification(
            correct: false,
            editDistance: distance,
            patterns: found.sorted()
        )
    }

    // MARK: - Distance

    /// Optimal string alignment distance; an adjacent transposition costs one,
    /// which is what lets "freind" be graded as a near miss rather than two errors.
    public static func damerauLevenshtein(_ a: String, _ b: String) -> Int {
        let x = Array(a), y = Array(b)
        let m = x.count, n = y.count
        if m == 0 { return n }
        if n == 0 { return m }

        var d = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)
        for i in 0...m { d[i][0] = i }
        for j in 0...n { d[0][j] = j }

        for i in 1...m {
            for j in 1...n {
                let cost = x[i - 1] == y[j - 1] ? 0 : 1
                d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
                if i > 1, j > 1, x[i - 1] == y[j - 2], x[i - 2] == y[j - 1] {
                    d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
                }
            }
        }
        return d[m][n]
    }

    // MARK: - Rules

    private static let vowels: Set<Character> = ["a", "e", "i", "o", "u"]

    /// QWERTY neighbours, for separating a thumb slip from a spelling error.
    private static let adjacent: [Character: String] = [
        "q": "wa", "w": "qeas", "e": "wrsd", "r": "etdf", "t": "ryfg",
        "y": "tugh", "u": "yijh", "i": "uokj", "o": "iplk", "p": "ol",
        "a": "qwsz", "s": "awedxz", "d": "serfcx", "f": "drtgvc", "g": "ftyhbv",
        "h": "gyujnb", "j": "huikmn", "k": "jiolm", "l": "kop",
        "z": "asx", "x": "zsdc", "c": "xdfv", "v": "cfgb", "b": "vghn",
        "n": "bhjm", "m": "njk",
    ]

    private static let silentGraphemes: [(String, String)] = [
        ("kn", "n"), ("wr", "r"), ("gn", "n"), ("ps", "s"), ("mb", "m"),
        ("gh", ""), ("bt", "t"), ("mn", "m"), ("rh", "r"), ("lm", "m"),
    ]

    private static let soundAlike: [(String, String)] = [
        ("ph", "f"), ("f", "ph"), ("c", "k"), ("k", "c"), ("c", "s"), ("s", "c"),
        ("z", "s"), ("s", "z"), ("j", "g"), ("g", "j"), ("qu", "kw"), ("x", "ks"),
    ]

    /// Longest first, so a longer prefix is never shadowed by a shorter one.
    private static let prefixes = ["inter", "over", "dis", "mis", "un", "im", "ir", "il"]

    private static func isTypo(
        _ t: String, _ s: String, distance: Int, context: Context
    ) -> Bool {
        guard distance == 1, t.count == s.count,
              let sub = singleSubstitution(t, s),
              adjacent[sub.from]?.contains(sub.to) == true
        else { return false }

        // Adjacency alone is not enough — "cat"/"vat" is adjacent but plausibly
        // a real error. Require the answer to have come back unusually fast too.
        guard let latency = context.latencyMs,
              let median = context.medianLatencyMs
        else { return false }
        return latency < median * 0.6
    }

    private static func isTransposition(_ t: String, _ s: String) -> Bool {
        guard t.count == s.count else { return false }
        let x = Array(t), y = Array(s)
        let diff = x.indices.filter { x[$0] != y[$0] }
        guard diff.count == 2, diff[1] == diff[0] + 1 else { return false }
        return x[diff[0]] == y[diff[1]] && x[diff[1]] == y[diff[0]]
    }

    private static func singleSubstitution(
        _ t: String, _ s: String
    ) -> (from: Character, to: Character)? {
        guard t.count == s.count else { return nil }
        let x = Array(t), y = Array(s)
        var found: (from: Character, to: Character)?
        for i in x.indices where x[i] != y[i] {
            if found != nil { return nil }
            found = (x[i], y[i])
        }
        return found
    }

    /// Number of doubled-letter runs: "necessary" is 1, "accommodate" is 2.
    private static func doubledRuns(_ w: String) -> Int {
        let chars = Array(w)
        guard chars.count > 1 else { return 0 }
        var count = 0
        var i = 0
        while i < chars.count - 1 {
            if chars[i] == chars[i + 1] {
                count += 1
                i += 2          // a run is counted once, not per overlapping pair
            } else {
                i += 1
            }
        }
        return count
    }

    private static func containsIeEi(_ w: String) -> Bool {
        w.contains("ie") || w.contains("ei")
    }

    private static func suffixDoublingError(_ t: String, _ s: String) -> Bool {
        let doubleable: Set<Character> = ["b", "d", "g", "l", "m", "n", "p", "r", "t"]
        for suffix in ["ing", "ed", "er", "est"] where t.hasSuffix(suffix) {
            let stem = String(t.dropLast(suffix.count))
            guard let last = stem.last, doubleable.contains(last),
                  stem.dropLast().last == last
            else { continue }
            if s == String(stem.dropLast()) + suffix { return true }
        }
        return false
    }

    private static func silentEError(_ t: String, _ s: String) -> Bool {
        if t.hasSuffix("e"), s == String(t.dropLast()) { return true }
        if s.hasSuffix("e"), t == String(s.dropLast()) { return true }
        // "hopeing" for "hoping": the silent e should have gone before -ing.
        for suffix in ["ing", "ed"] where s.hasSuffix(suffix) {
            let stem = String(s.dropLast(suffix.count))
            if stem.hasSuffix("e"), t == String(stem.dropLast()) + suffix { return true }
        }
        return false
    }

    private static func pluralRuleError(_ t: String, _ s: String) -> Bool {
        if t.hasSuffix("ies"), s == String(t.dropLast(3)) + "ys" { return true }
        if t.hasSuffix("ves"), s == String(t.dropLast(3)) + "fs" { return true }
        if t.hasSuffix("oes"), s == String(t.dropLast(2)) + "s" { return true }
        if t.hasSuffix("es"), s == String(t.dropLast(2)) + "s" { return true }
        return false
    }

    private static func silentLetterError(_ t: String, _ s: String) -> Bool {
        for (full, reduced) in silentGraphemes where t.contains(full) {
            if s == replaceFirst(t, full, with: reduced) { return true }
        }
        return false
    }

    /// The doubling straddles the prefix boundary — "mis" + "spell", "un" +
    /// "natural" — so the repeated letter is the prefix's last character meeting
    /// the stem's first, not a doubled letter sitting after the prefix.
    private static func prefixBoundaryError(_ t: String, _ s: String) -> Bool {
        for prefix in prefixes where t.hasPrefix(prefix) {
            let chars = Array(t)
            guard chars.count > prefix.count,
                  let last = prefix.last,
                  chars[prefix.count] == last
            else { continue }
            if s == prefix + String(chars.dropFirst(prefix.count + 1)) { return true }
        }
        return false
    }

    private static func soundsAlike(_ t: String, _ s: String) -> Bool {
        for (a, b) in soundAlike where t.contains(a) {
            if s == replaceFirst(t, a, with: b) { return true }
        }
        return false
    }

    private static func replaceFirst(
        _ haystack: String, _ needle: String, with replacement: String
    ) -> String {
        guard let range = haystack.range(of: needle) else { return haystack }
        return haystack.replacingCharacters(in: range, with: replacement)
    }

    private static func normalize(_ w: String) -> String {
        w.lowercased().filter { $0.isASCII && $0.isLetter }
    }
}
