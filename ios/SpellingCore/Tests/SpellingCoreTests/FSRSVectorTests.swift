import XCTest
@testable import SpellingCore

/// Validates the Swift FSRS port against `Vectors/fsrs.json`.
///
/// The `reference` cases in that file are recorded output from the actual
/// reference implementation (py-fsrs), so passing here means agreeing with the
/// real algorithm — not merely with our JavaScript. The `sequences` cases cover
/// accumulated state across several reviews, which single-function tests miss.
final class FSRSVectorTests: XCTestCase {

    private static let epsilon = 1e-9

    // MARK: Vector file

    struct Vectors: Decodable {
        let decay: Double
        let factor: Double
        let reference: [ReferenceCase]
        let sequences: [ReviewSequence]
        let grades: [GradeCase]
        let mastery: [MasteryCase]
    }

    struct ReferenceCase: Decodable {
        let fn: String
        let v: Double
        let rating: Int?
        let stability: Double?
        let difficulty: Double?
        let retrievability: Double?
        let elapsed: Double?
    }

    /// Named to avoid shadowing Swift's `Sequence` protocol.
    struct ReviewSequence: Decodable {
        let name: String
        let steps: [Step]

        struct Step: Decodable {
            let rating: Int
            let elapsedDays: Double
            let stability: Double
            let difficulty: Double
            let intervalDays: Int
            let reps: Int
            let lapses: Int
            let mastery: String
        }
    }

    struct GradeCase: Decodable {
        let input: Input
        let rating: Int

        struct Input: Decodable {
            let correct: Bool
            let editDistance: Int?
            let hintsUsed: Int?
            let replays: Int?
            let latencyMs: Double?
            let medianLatencyMs: Double?
        }
    }

    struct MasteryCase: Decodable {
        let input: Input
        let mastery: String

        struct Input: Decodable {
            let intervalDays: Int
            let rating: Int
            let reps: Int
            let previous: String?
        }
    }

    private lazy var vectors: Vectors = {
        guard let url = Bundle.module.url(
            forResource: "fsrs", withExtension: "json", subdirectory: "Vectors"
        ) else {
            fatalError("Vectors/fsrs.json missing — run `npm run vectors` in the repo root")
        }
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }()

    // MARK: Tests

    func testConstantsMatchReference() {
        let fsrs = FSRS()
        XCTAssertEqual(fsrs.decay, vectors.decay, accuracy: Self.epsilon)
        XCTAssertEqual(fsrs.factor, vectors.factor, accuracy: Self.epsilon)
    }

    func testEveryReferenceCaseMatchesPyFSRS() throws {
        let fsrs = FSRS()
        XCTAssertFalse(vectors.reference.isEmpty)

        for c in vectors.reference {
            let mine: Double
            switch c.fn {
            case "initial_stability":
                mine = fsrs.initialStability(rating: try rating(c.rating))
            case "initial_difficulty":
                mine = fsrs.initialDifficulty(rating: try rating(c.rating))
            case "retrievability":
                mine = fsrs.retrievability(
                    stability: try XCTUnwrap(c.stability),
                    elapsedDays: try XCTUnwrap(c.elapsed)
                )
            case "interval":
                mine = Double(fsrs.interval(stability: try XCTUnwrap(c.stability)))
            case "next_difficulty":
                mine = fsrs.nextDifficulty(
                    difficulty: try XCTUnwrap(c.difficulty),
                    rating: try rating(c.rating)
                )
            case "short_term_stability":
                mine = fsrs.shortTermStability(
                    stability: try XCTUnwrap(c.stability),
                    rating: try rating(c.rating)
                )
            case "next_stability":
                mine = fsrs.nextStability(
                    difficulty: try XCTUnwrap(c.difficulty),
                    stability: try XCTUnwrap(c.stability),
                    retrievability: try XCTUnwrap(c.retrievability),
                    rating: try rating(c.rating)
                )
            default:
                XCTFail("unknown reference case: \(c.fn)")
                continue
            }
            XCTAssertEqual(mine, c.v, accuracy: Self.epsilon, "\(c.fn) \(c)")
        }
    }

    func testReviewSequencesMatch() throws {
        let fsrs = FSRS()
        for sequence in vectors.sequences {
            var state: ReviewState?
            for (index, step) in sequence.steps.enumerated() {
                state = fsrs.review(
                    state: state,
                    rating: try rating(step.rating),
                    elapsedDays: step.elapsedDays
                )
                let s = try XCTUnwrap(state)
                let label = "\(sequence.name) step \(index)"
                XCTAssertEqual(s.stability, step.stability, accuracy: Self.epsilon, label)
                XCTAssertEqual(s.difficulty, step.difficulty, accuracy: Self.epsilon, label)
                XCTAssertEqual(s.intervalDays, step.intervalDays, label)
                XCTAssertEqual(s.reps, step.reps, label)
                XCTAssertEqual(s.lapses, step.lapses, label)
                XCTAssertEqual(s.mastery.rawValue, step.mastery, label)
            }
        }
    }

    func testGradeMapping() throws {
        for c in vectors.grades {
            let attempt = Grader.Attempt(
                correct: c.input.correct,
                editDistance: c.input.editDistance ?? 0,
                hintsUsed: c.input.hintsUsed ?? 0,
                replays: c.input.replays ?? 0,
                latencyMs: c.input.latencyMs,
                medianLatencyMs: c.input.medianLatencyMs
            )
            XCTAssertEqual(Grader.grade(attempt).rawValue, c.rating, "\(c.input)")
        }
    }

    func testMasteryMapping() throws {
        for c in vectors.mastery {
            let result = Grader.mastery(
                intervalDays: c.input.intervalDays,
                rating: try rating(c.input.rating),
                reps: c.input.reps,
                previous: c.input.previous.flatMap(Mastery.init(rawValue:))
            )
            XCTAssertEqual(result.rawValue, c.mastery, "\(c.input)")
        }
    }

    private func rating(_ raw: Int?) throws -> Rating {
        try XCTUnwrap(Rating(rawValue: try XCTUnwrap(raw)))
    }
}
