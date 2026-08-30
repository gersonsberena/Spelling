// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SpellingCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "SpellingCore", targets: ["SpellingCore"]),
    ],
    targets: [
        .target(name: "SpellingCore"),
        .testTarget(
            name: "SpellingCoreTests",
            dependencies: ["SpellingCore"],
            resources: [.copy("Vectors")]
        ),
    ]
)
