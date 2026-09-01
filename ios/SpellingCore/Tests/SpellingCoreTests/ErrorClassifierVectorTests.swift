import XCTest
@testable import SpellingCore

/// Validates the Swift classifier against `Vectors/classifier.json`, the same
/// file the JavaScript suite checks. A disagreement between the two languages
/// means one of them is wrong, and reports computed on device would drift from
/// reports computed on the server.
final class ErrorClassifierVectorTests: XCTestCase {

    struct Vectors: Decodable {
        let cases: [Case]

        struct Case: Decodable {
            let target: String
            let submitted: String
            let context: Context
            let correct: Bool
            let editDistance: Int
            let patterns: [String]

            struct Context: Decodable {
                let homophones: [String]?
                let latencyMs: Double?
                let medianLatencyMs: Double?
            }
        }
    }

    private lazy var vectors: Vectors = {
        guard let url = Bundle.module.url(
            forResource: "classifier", withExtension: "json", subdirectory: "Vectors"
        ) else {
            fatalError("Vectors/classifier.json missing — run `npm run vectors` in the repo root")
        }
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: url))
    }()

    func testEveryVectorCaseMatches() {
        XCTAssertFalse(vectors.cases.isEmpty)

        for c in vectors.cases {
            let result = ErrorClassifier.classify(
                target: c.target,
                submitted: c.submitted,
                context: .init(
                    homophones: c.context.homophones ?? [],
                    latencyMs: c.context.latencyMs,
                    medianLatencyMs: c.context.medianLatencyMs
                )
            )
            let label = "\(c.target) -> \(c.submitted)"
            XCTAssertEqual(result.correct, c.correct, label)
            XCTAssertEqual(result.editDistance, c.editDistance, label)
            XCTAssertEqual(result.patterns.map(\.rawValue), c.patterns, label)
        }
    }

    func testPatternsAreAlwaysSorted() {
        for c in vectors.cases {
            let result = ErrorClassifier.classify(target: c.target, submitted: c.submitted)
            XCTAssertEqual(result.patterns, result.patterns.sorted(), c.target)
        }
    }

    func testTranspositionCostsOneEdit() {
        XCTAssertEqual(ErrorClassifier.damerauLevenshtein("freind", "friend"), 1)
    }

    func testEveryPatternSlugIsRepresentableFromJSON() {
        for pattern in ErrorPattern.allCases {
            XCTAssertEqual(ErrorPattern(rawValue: pattern.rawValue), pattern)
        }
    }
}
