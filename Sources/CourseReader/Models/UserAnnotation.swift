import Foundation
import SwiftData

@Model
final class Highlight {
  var id: UUID
  var subjectID: String
  var moduleID: Int
  var selectedText: String
  var startOffset: Int
  var endOffset: Int
  var color: String
  var createdAt: Date
  var note: Note?

  init(
    subjectID: String, moduleID: Int, selectedText: String,
    startOffset: Int, endOffset: Int, color: String = "yellow"
  ) {
    self.id = UUID()
    self.subjectID = subjectID
    self.moduleID = moduleID
    self.selectedText = selectedText
    self.startOffset = startOffset
    self.endOffset = endOffset
    self.color = color
    self.createdAt = Date()
  }
}

@Model
final class Note {
  var id: UUID
  var subjectID: String
  var moduleID: Int
  var highlightID: UUID?
  var sectionID: String?
  var content: String
  var createdAt: Date
  var updatedAt: Date

  init(
    subjectID: String, moduleID: Int, highlightID: UUID? = nil,
    sectionID: String? = nil, content: String
  ) {
    self.id = UUID()
    self.subjectID = subjectID
    self.moduleID = moduleID
    self.highlightID = highlightID
    self.sectionID = sectionID
    self.content = content
    self.createdAt = Date()
    self.updatedAt = Date()
  }
}

@Model
final class Bookmark {
  var id: UUID
  var subjectID: String
  var moduleID: Int
  var sectionID: String?
  var title: String
  var scrollPosition: Double
  var createdAt: Date

  init(
    subjectID: String, moduleID: Int, sectionID: String? = nil,
    title: String, scrollPosition: Double = 0
  ) {
    self.id = UUID()
    self.subjectID = subjectID
    self.moduleID = moduleID
    self.sectionID = sectionID
    self.title = title
    self.scrollPosition = scrollPosition
    self.createdAt = Date()
  }
}
