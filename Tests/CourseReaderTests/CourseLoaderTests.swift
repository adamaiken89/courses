import Foundation
import Testing

@testable import CourseReader

@Test func subjectParseValidYAML() {
  let yaml = """
    subject: "Test Subject"
    time_budget_hours: 20
    target_level: beginner
    domain: programming
    prerequisites:
      - "Basic Python"
    learning_objectives:
      - "Learn Swift"
    modules:
      - id: 1
        name: "Intro to Swift"
        time_hours: 2
        prerequisites: []
        topics: [basics, syntax]
      - id: 2
        name: "Functions & Closures"
        time_hours: 3
        prerequisites: [1]
        topics: [functions, closures]
    """
  let subject = Subject.parse(yaml: yaml, directory: "test-swift")
  #expect(subject != nil)
  #expect(subject?.id == "test-swift")
  #expect(subject?.subject == "Test Subject")
  #expect(subject?.timeBudgetHours == 20)
  #expect(subject?.targetLevel == "beginner")
  #expect(subject?.domain == "programming")
  #expect(subject?.prerequisites == ["Basic Python"])
  #expect(subject?.learningObjectives == ["Learn Swift"])
  #expect(subject?.modules.count == 2)
  #expect(subject?.modules[0].id == 1)
  #expect(subject?.modules[0].name == "Intro to Swift")
  #expect(subject?.modules[0].timeHours == 2)
  #expect(subject?.modules[0].prerequisites == [])
  #expect(subject?.modules[0].topics == ["basics", "syntax"])
  #expect(subject?.modules[1].id == 2)
  #expect(subject?.modules[1].name == "Functions & Closures")
  #expect(subject?.modules[1].timeHours == 3)
  #expect(subject?.modules[1].prerequisites == [1])
  #expect(subject?.modules[1].topics == ["functions", "closures"])
}

@Test func subjectParseMissingSubjectField() {
  let yaml = """
    time_budget_hours: 10
    modules: []
    """
  let subject = Subject.parse(yaml: yaml, directory: "empty")
  #expect(subject == nil)
}

@Test func subjectParseEmptyModules() {
  let yaml = """
    subject: "Empty Course"
    modules: []
    """
  let subject = Subject.parse(yaml: yaml, directory: "empty-course")
  #expect(subject != nil)
  #expect(subject?.modules.isEmpty == true)
}

@Test func subjectParseModuleNameSpecialChars() throws {
  let yaml = """
    subject: "Special"
    modules:
      - id: 1
        name: "A & B: C / D (E) — F"
        time_hours: 1
        prerequisites: []
        topics: []
      - id: 2
        name: "Plain Name"
        time_hours: 1
        prerequisites: []
        topics: []
    """
  let subject = try #require(Subject.parse(yaml: yaml, directory: "special"))
  #expect(subject.modules[0].name == "A & B: C / D (E) — F")
  #expect(subject.modules[1].name == "Plain Name")
}

@Test func subjectParsePrereqList() throws {
  let yaml = """
    subject: "Prereq Test"
    modules:
      - id: 1
        name: "Module One"
        time_hours: 1
        prerequisites: []
        topics: []
      - id: 2
        name: "Module Two"
        time_hours: 1
        prerequisites: [1]
        topics: []
      - id: 3
        name: "Module Three"
        time_hours: 1
        prerequisites: [1, 2]
        topics: []
    """
  let subject = try #require(Subject.parse(yaml: yaml, directory: "prereqs"))
  #expect(subject.modules[0].prerequisites == [])
  #expect(subject.modules[1].prerequisites == [1])
  #expect(subject.modules[2].prerequisites == [1, 2])
}

@Test func subjectParseCommentsIgnored() throws {
  let yaml = """
    subject: "Comments"
    # this is a comment
    modules:
      - id: 1
        name: "Real Module"
        # comment inside module
        time_hours: 2
        prerequisites: []
        topics: []
    """
  let subject = try #require(Subject.parse(yaml: yaml, directory: "comments"))
  #expect(subject.modules.count == 1)
  #expect(subject.modules[0].name == "Real Module")
}

@Test func subjectFromDirectoryMissingSyllabus() {
  let url = URL(fileURLWithPath: "/tmp/nonexistent-dir-\(UUID().uuidString)")
  let subject = Subject.from(directory: "missing", url: url)
  #expect(subject == nil)
}

@MainActor
@Test func findModuleDirByPrefixScan() throws {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("coursereader-test-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let subjectsDir = tempDir.appendingPathComponent("subjects")
  let modulesDir = subjectsDir.appendingPathComponent("test-course").appendingPathComponent(
    "modules")
  try FileManager.default.createDirectory(at: modulesDir, withIntermediateDirectories: true)

  try FileManager.default.createDirectory(
    at: modulesDir.appendingPathComponent("01-intro-to-swift"), withIntermediateDirectories: false)
  try FileManager.default.createDirectory(
    at: modulesDir.appendingPathComponent("02-functions"), withIntermediateDirectories: false)

  let subject = Subject(
    id: "test-course", subject: "Test Course", timeBudgetHours: 10, targetLevel: "beginner",
    domain: "test", prerequisites: [], learningObjectives: [],
    modules: [
      ModuleMeta(
        id: 1, name: "Intro to Swift (Long Name)", timeHours: 2, prerequisites: [], topics: []),
      ModuleMeta(id: 2, name: "Functions & Closures", timeHours: 3, prerequisites: [1], topics: []),
    ])

  let loader = CourseLoader()
  let dir1 = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[0])
  #expect(dir1 != nil)
  #expect(dir1?.lastPathComponent == "01-intro-to-swift")

  let dir2 = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[1])
  #expect(dir2 != nil)
  #expect(dir2?.lastPathComponent == "02-functions")
}

@MainActor
@Test func findModuleDirMissingModule() throws {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("coursereader-test-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let modulesDir = tempDir.appendingPathComponent("subjects/test-course/modules")
  try FileManager.default.createDirectory(at: modulesDir, withIntermediateDirectories: true)
  try FileManager.default.createDirectory(
    at: modulesDir.appendingPathComponent("01-exists"), withIntermediateDirectories: false)

  let subject = Subject(
    id: "test-course", subject: "Test", timeBudgetHours: 1, targetLevel: "beginner",
    domain: "test", prerequisites: [], learningObjectives: [],
    modules: [
      ModuleMeta(id: 1, name: "Exists", timeHours: 1, prerequisites: [], topics: []),
      ModuleMeta(id: 99, name: "Missing", timeHours: 1, prerequisites: [], topics: []),
    ])

  let subjectsDir = tempDir.appendingPathComponent("subjects")
  let loader = CourseLoader()
  let found = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[0])
  #expect(found != nil)

  let missing = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[1])
  #expect(missing == nil)
}

@MainActor
@Test func findModuleDirPartialPrefixMatch() throws {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("coursereader-test-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let modulesDir = tempDir.appendingPathComponent("subjects/partial-test/modules")
  try FileManager.default.createDirectory(at: modulesDir, withIntermediateDirectories: true)
  try FileManager.default.createDirectory(
    at: modulesDir.appendingPathComponent("01-foo"), withIntermediateDirectories: false)
  try FileManager.default.createDirectory(
    at: modulesDir.appendingPathComponent("02"), withIntermediateDirectories: false)

  let subject = Subject(
    id: "partial-test", subject: "Partial", timeBudgetHours: 1, targetLevel: "beginner",
    domain: "test", prerequisites: [], learningObjectives: [],
    modules: [
      ModuleMeta(id: 1, name: "Foo", timeHours: 1, prerequisites: [], topics: []),
      ModuleMeta(id: 2, name: "Bar", timeHours: 1, prerequisites: [], topics: []),
    ])

  let subjectsDir = tempDir.appendingPathComponent("subjects")
  let loader = CourseLoader()
  let dir1 = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[0])
  #expect(dir1?.lastPathComponent == "01-foo")

  let dir2 = loader.findModuleDir(
    subjectsDir: subjectsDir, subject: subject, module: subject.modules[1])
  #expect(dir2?.lastPathComponent == "02")
}

@MainActor
@Test func loadSubjectsFromDirectory() throws {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("coursereader-test-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let subjectDir = tempDir.appendingPathComponent("valid-subject")
  try FileManager.default.createDirectory(at: subjectDir, withIntermediateDirectories: true)
  try FileManager.default.createDirectory(
    at: tempDir.appendingPathComponent("srs"), withIntermediateDirectories: true)

  let syllabus = """
    subject: "Valid"
    modules:
      - id: 1
        name: "Module One"
        time_hours: 1
        prerequisites: []
        topics: []
    """
  try syllabus.write(
    to: subjectDir.appendingPathComponent("syllabus.yaml"), atomically: true, encoding: .utf8)

  let loader = CourseLoader()
  let subjects = loader.loadSubjects(from: tempDir)
  #expect(subjects.count == 1)
  #expect(subjects[0].id == "valid-subject")
  #expect(subjects[0].modules.count == 1)
}

@MainActor
@Test func loadSubjectsEmptyDir() {
  let tempDir = FileManager.default.temporaryDirectory
    .appendingPathComponent("coursereader-test-\(UUID().uuidString)")
  defer { try? FileManager.default.removeItem(at: tempDir) }

  let loader = CourseLoader()
  let subjects = loader.loadSubjects(from: tempDir)
  #expect(subjects.isEmpty == true)
}
