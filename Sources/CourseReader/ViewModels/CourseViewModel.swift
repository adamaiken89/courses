import Foundation
import Observation

enum AppScreen: Hashable {
  case subjectList
  case lesson(Subject, ModuleMeta)
  case reader(Subject)
  case quiz(Subject, ModuleMeta)
  case askAI(Subject, ModuleMeta)
  case review(Subject)
  case settings
}

@Observable
@MainActor
final class CourseViewModel {
  static let shared = CourseViewModel()

  var subjects: [Subject] = []
  var selectedSubject: Subject?
  var selectedModule: ModuleMeta?
  var lessonContent: String = ""
  var highlightedText: String = ""
  var aiQuestion: String = ""
  var aiResponse: String = ""
  var isAIThinking = false
  var aiError: String?
  var navigationPath: [AppScreen] = [.subjectList]

  var readerSubject: Subject?
  var readerSelectedModule: ModuleMeta?
  var readerSections: [ModuleSection] = []
  var readerScrollTarget: String?

  let quizEngine = QuizEngine()
  let courseLoader = CourseLoader.shared
  let gemini = GeminiService.shared

  var lessonFontSize: Double = DesignConstants.FontSize.lessonDefault {
    didSet {
      UserDefaults.standard.set(lessonFontSize, forKey: "lessonFontSize")
    }
  }

  private init() {
    let saved = UserDefaults.standard.double(forKey: "lessonFontSize")
    if saved != 0 {
      lessonFontSize = saved
    }
  }

  func loadSubjects() {
    subjects = courseLoader.loadSubjects()
  }

  func selectSubject(_ subject: Subject) {
    selectedSubject = subject
    openReader(subject)
  }

  func openReader(_ subject: Subject) {
    readerSubject = subject
    if let first = subject.modules.first {
      selectReaderModule(first)
    }
    navigationPath.append(.reader(subject))
  }

  func selectReaderModule(_ module: ModuleMeta) {
    guard let subject = readerSubject else { return }
    readerSelectedModule = module
    lessonContent = courseLoader.loadLesson(subject: subject, module: module)
    readerSections = ModuleSection.parse(from: lessonContent)
    readerScrollTarget = nil
  }

  func scrollReaderToSection(_ section: ModuleSection) {
    readerScrollTarget = section.heading
  }

  func startQuiz(subject: Subject, module: ModuleMeta) {
    let questions = courseLoader.loadQuiz(subject: subject, module: module)
    quizEngine.load(questions)
    navigationPath.append(.quiz(subject, module))
  }

  func startReview(subject: Subject) {
    navigationPath.append(.review(subject))
  }

  func askAI() {
    guard !highlightedText.isEmpty, !aiQuestion.isEmpty else { return }
    isAIThinking = true
    aiError = nil
    aiResponse = ""

    Task {
      do {
        let response = try await gemini.askAboutHighlight(
          highlightedText: highlightedText,
          question: aiQuestion
        )
        aiResponse = response
      } catch {
        aiError = error.localizedDescription
      }
      isAIThinking = false
    }
  }

  func goBack() {
    guard navigationPath.count > 1 else { return }
    navigationPath.removeLast()
  }

  func goHome() {
    navigationPath = [.subjectList]
    selectedSubject = nil
    selectedModule = nil
    lessonContent = ""
    highlightedText = ""
    aiQuestion = ""
    aiResponse = ""
    aiError = nil
    readerSubject = nil
    readerSelectedModule = nil
    readerSections = []
    readerScrollTarget = nil
    quizEngine.reset()
  }
}
