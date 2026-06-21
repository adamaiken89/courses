// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CourseReader",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v15)
    ],
    dependencies: [
        .package(url: "https://github.com/smittytone/HighlighterSwift.git", from: "3.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "CourseReader",
            dependencies: [
                .product(name: "Highlighter", package: "HighlighterSwift"),
            ],
            path: "Sources/CourseReader",
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "CourseReaderTests",
            dependencies: ["CourseReader"],
            path: "Tests/CourseReaderTests"
        ),
    ]
)
