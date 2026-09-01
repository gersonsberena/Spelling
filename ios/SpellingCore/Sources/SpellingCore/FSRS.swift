import Foundation

/// Grades, matching FSRS. The spelling-specific mapping is in `Grader`.
public enum Rating: Int, Codable, Sendable, CaseIterable {
    case again = 1, hard = 2, good = 3, easy = 4
}

/// How well a word is known, as shown to the learner and counted for parents.
public enum Mastery: String, Codable, Sendable {
    case new, learning, review, mastered, lapsed
}

/// Per-(profile, word) scheduling state. Mirrors the `review_state` table.
public struct ReviewState: Codable, Sendable, Equatable {
    public var stability: Double
    public var difficulty: Double
    public var intervalDays: Int
    public var reps: Int
    public var lapses: Int
    public var mastery: Mastery

    public init(
        stability: Double = 0,
        difficulty: Double = 5,
        intervalDays: Int = 0,
        reps: Int = 0,
        lapses: Int = 0,
        mastery: Mastery = .new
    ) {
        self.stability = stability
        self.difficulty = difficulty
        self.intervalDays = intervalDays
        self.reps = reps
        self.lapses = lapses
        self.mastery = mastery
    }
}

/// FSRS-6 core math.
///
/// Ported from the reference implementation (open-spaced-repetition/py-fsrs,
/// MIT, `fsrs/scheduler.py`). The JavaScript in `pipeline/lib/fsrs.mjs` and this
/// file are checked against the same recorded py-fsrs output — see
/// `Tests/SpellingCoreTests/Vectors/fsrs.json`. If the two languages ever
/// disagree, one of them is wrong.
///
/// Scheduling is deliberately deterministic: the reference's interval fuzz is
/// omitted so device and server derive identical due dates.
public struct FSRS: Sendable {
    public static let defaultParameters: [Double] = [
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
        1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
        1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ]

    private static let stabilityMin = 0.001
    private static let minDifficulty = 1.0
    private static let maxDifficulty = 10.0

    public let w: [Double]
    public let desiredRetention: Double
    public let decay: Double
    public let factor: Double

    public init(
        parameters: [Double] = FSRS.defaultParameters,
        desiredRetention: Double = 0.9
    ) {
        precondition(
            parameters.count == 21,
            "FSRS-6 needs 21 parameters, got \(parameters.count)"
        )
        self.w = parameters
        self.desiredRetention = desiredRetention
        self.decay = -parameters[20]
        self.factor = pow(0.9, 1 / -parameters[20]) - 1
    }

    /// Probability of recall after `elapsedDays` at the given stability.
    public func retrievability(stability: Double, elapsedDays: Double) -> Double {
        guard stability > 0 else { return 0 }
        let t = max(0, elapsedDays)
        return pow(1 + factor * t / stability, decay)
    }

    public func initialStability(rating: Rating) -> Double {
        clampStability(w[rating.rawValue - 1])
    }

    public func initialDifficulty(rating: Rating, clamp: Bool = true) -> Double {
        let d = w[4] - exp(w[5] * Double(rating.rawValue - 1)) + 1
        return clamp ? clampDifficulty(d) : d
    }

    /// Days until the word should next be asked. Never less than one.
    public func interval(stability: Double) -> Int {
        let days = (stability / factor) * (pow(desiredRetention, 1 / decay) - 1)
        return max(1, Int(days.rounded()))
    }

    public func nextDifficulty(difficulty: Double, rating: Rating) -> Double {
        let delta = -(w[6] * Double(rating.rawValue - 3))
        // Linear damping: a word already near maximum difficulty moves less.
        let damped = difficulty + (10 - difficulty) * delta / 9
        // Reverts toward the difficulty an Easy first answer would have given.
        let target = initialDifficulty(rating: .easy, clamp: false)
        return clampDifficulty(w[7] * target + (1 - w[7]) * damped)
    }

    /// Same-session repeat, as opposed to a review a day or more later.
    public func shortTermStability(stability: Double, rating: Rating) -> Double {
        var increase = exp(w[17] * (Double(rating.rawValue) - 3 + w[18]))
            * pow(stability, -w[19])
        if rating != .again { increase = max(increase, 1) }
        return clampStability(stability * increase)
    }

    public func nextStability(
        difficulty: Double,
        stability: Double,
        retrievability r: Double,
        rating: Rating
    ) -> Double {
        let s = rating == .again
            ? forgetStability(difficulty: difficulty, stability: stability, retrievability: r)
            : recallStability(difficulty: difficulty, stability: stability, retrievability: r, rating: rating)
        return clampStability(s)
    }

    public func forgetStability(
        difficulty: Double, stability: Double, retrievability r: Double
    ) -> Double {
        let longTerm = w[11]
            * pow(difficulty, -w[12])
            * (pow(stability + 1, w[13]) - 1)
            * exp((1 - r) * w[14])
        let shortTerm = stability / exp(w[17] * w[18])
        return min(longTerm, shortTerm)
    }

    public func recallStability(
        difficulty: Double, stability: Double, retrievability r: Double, rating: Rating
    ) -> Double {
        let hardPenalty = rating == .hard ? w[15] : 1
        let easyBonus = rating == .easy ? w[16] : 1
        return stability * (1 + exp(w[8])
            * (11 - difficulty)
            * pow(stability, -w[9])
            * (exp((1 - r) * w[10]) - 1)
            * hardPenalty
            * easyBonus)
    }

    /// Advance one review. Pass `nil` for a word never attempted.
    public func review(
        state: ReviewState?,
        rating: Rating,
        elapsedDays: Double = 0
    ) -> ReviewState {
        let stability: Double
        let difficulty: Double

        if state == nil || state?.reps == 0 {
            stability = initialStability(rating: rating)
            difficulty = initialDifficulty(rating: rating)
        } else if let prior = state, elapsedDays < 1 {
            stability = shortTermStability(stability: prior.stability, rating: rating)
            difficulty = nextDifficulty(difficulty: prior.difficulty, rating: rating)
        } else if let prior = state {
            let r = retrievability(stability: prior.stability, elapsedDays: elapsedDays)
            stability = nextStability(
                difficulty: prior.difficulty,
                stability: prior.stability,
                retrievability: r,
                rating: rating
            )
            difficulty = nextDifficulty(difficulty: prior.difficulty, rating: rating)
        } else {
            fatalError("unreachable")
        }

        let reps = (state?.reps ?? 0) + 1
        let lapses = (state?.lapses ?? 0) + (rating == .again ? 1 : 0)
        let intervalDays = interval(stability: stability)

        return ReviewState(
            stability: stability,
            difficulty: difficulty,
            intervalDays: intervalDays,
            reps: reps,
            lapses: lapses,
            mastery: Grader.mastery(
                intervalDays: intervalDays,
                rating: rating,
                reps: reps,
                previous: state?.mastery
            )
        )
    }

    private func clampStability(_ s: Double) -> Double { max(s, Self.stabilityMin) }
    private func clampDifficulty(_ d: Double) -> Double {
        min(max(d, Self.minDifficulty), Self.maxDifficulty)
    }
}
