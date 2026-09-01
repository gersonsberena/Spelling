import Foundation

/// Turns a spelling attempt into an FSRS grade and a mastery state.
public enum Grader {

    /// What the learner did on one word.
    public struct Attempt: Sendable {
        public var correct: Bool
        public var editDistance: Int
        public var hintsUsed: Int
        public var replays: Int
        public var latencyMs: Double?
        /// This profile's median answer time, for the Easy test.
        public var medianLatencyMs: Double?

        public init(
            correct: Bool,
            editDistance: Int = 0,
            hintsUsed: Int = 0,
            replays: Int = 0,
            latencyMs: Double? = nil,
            medianLatencyMs: Double? = nil
        ) {
            self.correct = correct
            self.editDistance = editDistance
            self.hintsUsed = hintsUsed
            self.replays = replays
            self.latencyMs = latencyMs
            self.medianLatencyMs = medianLatencyMs
        }
    }

    /// Map an attempt onto an FSRS grade.
    ///
    /// The `hard` cases are the point: a one-letter slip is not the same event
    /// as a word the learner has never seen, and grading them identically throws
    /// away the most useful signal a spelling app has.
    public static func grade(_ a: Attempt) -> Rating {
        guard a.correct else {
            return a.editDistance == 1 ? .hard : .again
        }
        if a.hintsUsed > 0 || a.replays >= 3 { return .hard }
        if let latency = a.latencyMs,
           let median = a.medianLatencyMs,
           median > 0,
           latency < median * 0.5 {
            return .easy
        }
        return .good
    }

    public static func mastery(
        intervalDays: Int,
        rating: Rating,
        reps: Int,
        previous: Mastery?
    ) -> Mastery {
        if rating == .again {
            return (previous == .mastered || previous == .review) ? .lapsed : .learning
        }
        if intervalDays >= 21 && reps >= 3 { return .mastered }
        if intervalDays >= 3 { return .review }
        return .learning
    }
}
