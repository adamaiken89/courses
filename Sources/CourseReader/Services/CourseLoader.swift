import Foundation

@MainActor
final class CourseLoader {
  static let shared = CourseLoader()

  private var subjectsDir: URL? {
    let possiblePaths = [
      URL(fileURLWithPath: "\(FileManager.default.currentDirectoryPath)/subjects"),
      URL(fileURLWithPath: "\(NSHomeDirectory())/Desktop/courses/subjects"),
    ]

    let bundlePath = Bundle.main.resourceURL?.appendingPathComponent("subjects")
    if let bp = bundlePath, FileManager.default.fileExists(atPath: bp.path) {
      return bp
    }

    for path in possiblePaths {
      if FileManager.default.fileExists(atPath: path.path) {
        return path
      }
    }

    return nil
  }

  func loadSubjects() -> [Subject] {
    guard let subjectsDir else { return [] }
    return loadSubjects(from: subjectsDir)
  }

  func loadSubjects(from directory: URL) -> [Subject] {
    guard
      let entries = try? FileManager.default.contentsOfDirectory(
        at: directory, includingPropertiesForKeys: nil
      )
    else { return [] }

    return
      entries
      .filter { $0.hasDirectoryPath }
      .compactMap { url -> Subject? in
        let dirName = url.lastPathComponent
        guard dirName != "srs" else { return nil }
        return Subject.from(directory: dirName, url: url)
      }
      .sorted { $0.displayName < $1.displayName }
  }

  func loadLesson(subject: Subject, module: ModuleMeta) -> String {
    guard let subjectsDir else { return "" }
    guard let moduleDir = findModuleDir(subjectsDir: subjectsDir, subject: subject, module: module)
    else { return "" }
    let lessonURL = moduleDir.appendingPathComponent("lesson.md")
    guard let data = try? Data(contentsOf: lessonURL),
      let content = String(data: data, encoding: .utf8)
    else { return "" }
    return content
  }

  func loadQuiz(subject: Subject, module: ModuleMeta) -> [QuizQuestion] {
    guard let subjectsDir else { return [] }
    guard let moduleDir = findModuleDir(subjectsDir: subjectsDir, subject: subject, module: module)
    else { return [] }
    let quizURL = moduleDir.appendingPathComponent("quiz.yaml")
    return QuizQuestion.load(from: quizURL)
  }

  func findModuleDir(subjectsDir: URL, subject: Subject, module: ModuleMeta) -> URL? {
    let modulesDir =
      subjectsDir
      .appendingPathComponent(subject.directoryName)
      .appendingPathComponent("modules")
    let padded = String(format: "%02d", module.id)
    guard
      let entries = try? FileManager.default.contentsOfDirectory(
        at: modulesDir, includingPropertiesForKeys: nil
      )
    else { return nil }
    return entries.first(where: { $0.lastPathComponent.hasPrefix(padded) && $0.hasDirectoryPath })
  }

  func loadSRSDeck(subjectId: String) -> SRSDeck {
    guard let subjectsDir else { return SRSDeck(cards: [:]) }
    let srsURL =
      subjectsDir
      .appendingPathComponent(subjectId)
      .appendingPathComponent("srs")
      .appendingPathComponent("deck.json")

    if let data = try? Data(contentsOf: srsURL),
      let deck = try? JSONDecoder().decode(SRSDeck.self, from: data)
    {
      return deck
    }
    return SRSDeck(cards: [:])
  }

  func saveSRSDeck(_ deck: SRSDeck, subjectId: String) {
    guard let subjectsDir else { return }
    let srsDir =
      subjectsDir
      .appendingPathComponent(subjectId)
      .appendingPathComponent("srs")

    try? FileManager.default.createDirectory(at: srsDir, withIntermediateDirectories: true)
    let srsURL = srsDir.appendingPathComponent("deck.json")
    if let data = try? JSONEncoder().encode(deck) {
      try? data.write(to: srsURL)
    }
  }
}
