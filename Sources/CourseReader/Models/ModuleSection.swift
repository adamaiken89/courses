import Foundation

struct ModuleSection: Identifiable, Hashable {
  let id: String
  let heading: String
  let level: Int

  static func parse(from markdown: String) -> [ModuleSection] {
    var sections: [ModuleSection] = []
    for line in markdown.components(separatedBy: .newlines) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.hasPrefix("## ") || trimmed.hasPrefix("### ") {
        let level = trimmed.hasPrefix("## ") ? 2 : 3
        let prefixLen = level == 2 ? 3 : 4
        let heading = String(trimmed.dropFirst(prefixLen))
        let id = heading.lowercased()
          .replacingOccurrences(of: " ", with: "-")
          .replacingOccurrences(of: ":", with: "")
          .replacingOccurrences(of: ",", with: "")
          .replacingOccurrences(of: "(", with: "")
          .replacingOccurrences(of: ")", with: "")
        sections.append(ModuleSection(id: id, heading: heading, level: level))
      }
    }
    return sections
  }
}
