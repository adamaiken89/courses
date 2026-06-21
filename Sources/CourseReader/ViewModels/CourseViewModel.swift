import Foundation
import Observation

enum NavigationDirection { case prev, next }

enum ReviewFilter: String, CaseIterable {
  case all
  case due
  case starred
}

enum AppScreen: Hashable {
  case subjectList
  case lesson(Subject, ModuleMeta)
  case reader(Subject)
  case quiz(Subject, ModuleMeta)
  case askAI(Subject, ModuleMeta)
  case review(Subject)
  case settings
  case bookmarks
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
  var readerVisibleSectionId: String?

  var hasPrevModule: Bool {
    guard let subject = readerSubject, let current = readerSelectedModule,
          let idx = subject.modules.firstIndex(of: current)
    else { return false }
    return idx > 0
  }

  var hasNextModule: Bool {
    guard let subject = readerSubject, let current = readerSelectedModule,
          let idx = subject.modules.firstIndex(of: current)
    else { return false }
    return idx < subject.modules.count - 1
  }

  var hasPrevSection: Bool {
    guard !readerSections.isEmpty, let current = readerVisibleSectionId,
          let idx = readerSections.firstIndex(where: { $0.id == current })
    else { return false }
    return idx > 0
  }

  var hasNextSection: Bool {
    guard !readerSections.isEmpty, let current = readerVisibleSectionId,
          let idx = readerSections.firstIndex(where: { $0.id == current })
    else { return false }
    return idx < readerSections.count - 1
  }

  var currentHighlights: [Highlight] = []
  var currentNotes: [Note] = []
  var isBookmarked = false
  var currentSRSDeck = SRSDeck(cards: [:])
  var reviewFilter = ReviewFilter.all

  let quizEngine = QuizEngine()
  let courseLoader = CourseLoader.shared
  let gemini = GeminiService.shared
  let storage = StorageService.shared

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
    readerVisibleSectionId = readerSections.first?.id
    readerScrollTarget = nil
  }

  func scrollReaderToSection(_ section: ModuleSection) {
    readerScrollTarget = section.heading
  }

  func navigateToModule(_ direction: NavigationDirection) {
    guard let subject = readerSubject, let current = readerSelectedModule,
          let idx = subject.modules.firstIndex(of: current)
    else { return }
    let target = direction == .next ? idx + 1 : idx - 1
    guard subject.modules.indices.contains(target) else { return }
    selectReaderModule(subject.modules[target])
  }

  func navigateToSection(_ direction: NavigationDirection) {
    guard !readerSections.isEmpty, let current = readerVisibleSectionId,
          let idx = readerSections.firstIndex(where: { $0.id == current })
    else { return }
    let target = direction == .next ? idx + 1 : idx - 1
    guard readerSections.indices.contains(target) else { return }
    scrollReaderToSection(readerSections[target])
  }

  func startQuiz(subject: Subject, module: ModuleMeta) {
    let questions = courseLoader.loadQuiz(subject: subject, module: module)
    quizEngine.load(questions)
    navigationPath.append(.quiz(subject, module))
  }

  func startReview(subject: Subject) {
    currentSRSDeck = courseLoader.loadSRSDeck(subjectId: subject.id)
    reviewFilter = .all
    navigationPath.append(.review(subject))
  }

  func toggleStar(cardId: String) {
    currentSRSDeck.toggleStar(cardId: cardId)
    guard let subject = readerSubject else { return }
    courseLoader.saveSRSDeck(currentSRSDeck, subjectId: subject.id)
  }

  var displayedCards: [SRSCard] {
    guard let subject = readerSubject else { return [] }
    switch reviewFilter {
    case .all: return currentSRSDeck.allCards(for: subject.id)
    case .due: return currentSRSDeck.dueCards(for: subject.id)
    case .starred: return currentSRSDeck.starredCards(for: subject.id)
    }
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

  func increaseFontSize() {
    lessonFontSize = min(28, lessonFontSize + 2)
  }

  func decreaseFontSize() {
    lessonFontSize = max(10, lessonFontSize - 2)
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
    currentHighlights = []
    currentNotes = []
    isBookmarked = false
    quizEngine.reset()
  }

  // MARK: - Annotations

  func loadAnnotations() {
    guard let subject = readerSubject, let module = readerSelectedModule else { return }
    currentHighlights = storage.highlightsForModule(subjectID: subject.id, moduleID: module.id)
    currentNotes = storage.notesForModule(subjectID: subject.id, moduleID: module.id)
    isBookmarked = storage.isBookmarked(subjectID: subject.id, moduleID: module.id)
  }

  func addHighlight(selectedText: String, startOffset: Int, endOffset: Int, color: String) {
    guard let subject = readerSubject, let module = readerSelectedModule else { return }
    _ = storage.addHighlight(
      subjectID: subject.id, moduleID: module.id, selectedText: selectedText,
      startOffset: startOffset, endOffset: endOffset, color: color)
    loadAnnotations()
  }

  func deleteHighlight(_ highlight: Highlight) {
    storage.deleteHighlight(highlight)
    loadAnnotations()
  }

  func addNote(content: String, highlightID: UUID? = nil, sectionID: String? = nil) {
    guard let subject = readerSubject, let module = readerSelectedModule else { return }
    _ = storage.addNote(
      subjectID: subject.id, moduleID: module.id, highlightID: highlightID,
      sectionID: sectionID, content: content)
    loadAnnotations()
  }

  func updateNote(_ note: Note, content: String) {
    storage.updateNote(note, content: content)
    loadAnnotations()
  }

  func deleteNote(_ note: Note) {
    storage.deleteNote(note)
    loadAnnotations()
  }

  func toggleBookmark() {
    guard let subject = readerSubject, let module = readerSelectedModule else { return }
    if isBookmarked {
      let bookmarks = storage.bookmarksForSubject(subject.id)
      if let existing = bookmarks.first(where: { $0.moduleID == module.id }) {
        storage.deleteBookmark(existing)
      }
    } else {
      _ = storage.addBookmark(
        subjectID: subject.id, moduleID: module.id,
        title: module.name, scrollPosition: 0)
    }
    isBookmarked.toggle()
  }

  func allBookmarks() -> [Bookmark] {
    storage.allBookmarks()
  }

  func openBookmarks() {
    navigationPath.append(.bookmarks)
  }

  func openReaderToBookmark(subjectID: String, moduleID: Int) {
    guard let subject = subjects.first(where: { $0.id == subjectID }),
          let module = subject.modules.first(where: { $0.id == moduleID })
    else { return }
    readerSubject = subject
    readerSelectedModule = module
    lessonContent = courseLoader.loadLesson(subject: subject, module: module)
    readerSections = ModuleSection.parse(from: lessonContent)
    readerVisibleSectionId = readerSections.first?.id
    readerScrollTarget = nil
    navigationPath.append(.reader(subject))
  }
}
