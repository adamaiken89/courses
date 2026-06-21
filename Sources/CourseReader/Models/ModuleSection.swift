import Foundation

struct ModuleSection: Identifiable, Hashable {
  let id: String
  let heading: String
  let level: Int
  let parentID: String?

  static func parse(from markdown: String) -> [ModuleSection] {
    var sections: [ModuleSection] = []
    var levelStack: [Int] = []
    var idStack: [String] = []
    for line in markdown.components(separatedBy: .newlines) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      let level: Int
      if trimmed.hasPrefix("###### ") {
        level = 6
      } else if trimmed.hasPrefix("##### ") {
        level = 5
      } else if trimmed.hasPrefix("#### ") {
        level = 4
      } else if trimmed.hasPrefix("### ") {
        level = 3
      } else if trimmed.hasPrefix("## ") {
        level = 2
      } else if trimmed.hasPrefix("# ") {
        level = 1
      } else {
        continue
      }

      let heading = String(trimmed.dropFirst(level + 1))
      let id = heading.lowercased()
        .replacingOccurrences(of: " ", with: "-")
        .replacingOccurrences(of: ":", with: "")
        .replacingOccurrences(of: ",", with: "")
        .replacingOccurrences(of: "(", with: "")
        .replacingOccurrences(of: ")", with: "")
      
      // pop stack until find parent level
      while !levelStack.isEmpty && levelStack.last! >= level {
        _ = levelStack.popLast()
        _ = idStack.popLast()
      }
      let parentID = idStack.last
      levelStack.append(level)
      idStack.append(id)
      
      sections.append(ModuleSection(id: id, heading: heading, level: level, parentID: parentID))
    }
    return sections
  }
}
