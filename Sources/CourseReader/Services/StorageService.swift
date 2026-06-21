import Foundation
import SwiftData

@MainActor
final class StorageService {
  static let shared = StorageService()

  var modelContainer: ModelContainer?
  var modelContext: ModelContext?

  private init() {}

  func setup() throws {
    let config = ModelConfiguration(isStoredInMemoryOnly: false)
    let container = try ModelContainer(
      for: Highlight.self, Note.self, Bookmark.self, configurations: config)
    self.modelContainer = container
    self.modelContext = container.mainContext
  }

  func save() {
    try? modelContext?.save()
  }

  // MARK: - Highlights

  func addHighlight(
    subjectID: String, moduleID: Int, selectedText: String,
    startOffset: Int, endOffset: Int, color: String = "yellow"
  ) -> Highlight {
    let highlight = Highlight(
      subjectID: subjectID, moduleID: moduleID, selectedText: selectedText,
      startOffset: startOffset, endOffset: endOffset, color: color)
    modelContext?.insert(highlight)
    save()
    return highlight
  }

  func highlightsForModule(subjectID: String, moduleID: Int) -> [Highlight] {
    let descriptor = FetchDescriptor<Highlight>(
      predicate: #Predicate { $0.subjectID == subjectID && $0.moduleID == moduleID },
      sortBy: [SortDescriptor(\.createdAt)]
    )
    return (try? modelContext?.fetch(descriptor)) ?? []
  }

  func deleteHighlight(_ highlight: Highlight) {
    modelContext?.delete(highlight)
    save()
  }

  // MARK: - Notes

  func addNote(
    subjectID: String, moduleID: Int, highlightID: UUID? = nil,
    sectionID: String? = nil, content: String
  ) -> Note {
    let note = Note(
      subjectID: subjectID, moduleID: moduleID, highlightID: highlightID,
      sectionID: sectionID, content: content)
    modelContext?.insert(note)
    save()
    return note
  }

  func notesForModule(subjectID: String, moduleID: Int) -> [Note] {
    let descriptor = FetchDescriptor<Note>(
      predicate: #Predicate { $0.subjectID == subjectID && $0.moduleID == moduleID },
      sortBy: [SortDescriptor(\.createdAt)]
    )
    return (try? modelContext?.fetch(descriptor)) ?? []
  }

  func updateNote(_ note: Note, content: String) {
    note.content = content
    note.updatedAt = Date()
    save()
  }

  func deleteNote(_ note: Note) {
    modelContext?.delete(note)
    save()
  }

  // MARK: - Bookmarks

  func addBookmark(
    subjectID: String, moduleID: Int, sectionID: String? = nil,
    title: String, scrollPosition: Double = 0
  ) -> Bookmark {
    let bookmark = Bookmark(
      subjectID: subjectID, moduleID: moduleID, sectionID: sectionID,
      title: title, scrollPosition: scrollPosition)
    modelContext?.insert(bookmark)
    save()
    return bookmark
  }

  func allBookmarks() -> [Bookmark] {
    let descriptor = FetchDescriptor<Bookmark>(
      sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
    return (try? modelContext?.fetch(descriptor)) ?? []
  }

  func bookmarksForSubject(_ subjectID: String) -> [Bookmark] {
    let descriptor = FetchDescriptor<Bookmark>(
      predicate: #Predicate { $0.subjectID == subjectID },
      sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
    )
    return (try? modelContext?.fetch(descriptor)) ?? []
  }

  func deleteBookmark(_ bookmark: Bookmark) {
    modelContext?.delete(bookmark)
    save()
  }

  func isBookmarked(subjectID: String, moduleID: Int) -> Bool {
    let descriptor = FetchDescriptor<Bookmark>(
      predicate: #Predicate {
        $0.subjectID == subjectID && $0.moduleID == moduleID
      }
    )
    return (try? modelContext?.fetchCount(descriptor)) ?? 0 > 0
  }
}
