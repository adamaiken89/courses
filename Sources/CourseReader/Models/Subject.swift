import Foundation

struct Subject: Codable, Identifiable, Hashable {
  let id: String
  let subject: String
  let timeBudgetHours: Int
  let targetLevel: String
  let domain: String
  let prerequisites: [String]
  let learningObjectives: [String]
  let modules: [ModuleMeta]

  var displayName: String { subject }
  var directoryName: String { id }

  static func from(directory: String, url: URL) -> Subject? {
    let syllabusURL = url.appendingPathComponent("syllabus.yaml")
    guard let data = try? Data(contentsOf: syllabusURL),
      let yamlString = String(data: data, encoding: .utf8)
    else { return nil }
    return Subject.parse(yaml: yamlString, directory: directory)
  }

  static func parse(yaml: String, directory: String) -> Subject? {
    var subject = ""
    var timeBudget = 40
    var targetLevel = "intermediate"
    var domain = ""
    var prereqs: [String] = []
    var objectives: [String] = []
    var modules: [ModuleMeta] = []
    var inObjectives = false
    var inPrereqs = false
    var inModules = false
    var currentModule: (id: Int, name: String, hours: Double, prereqs: [Int], topics: [String])?

    let lines = yaml.components(separatedBy: .newlines)
    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)
      if trimmed.hasPrefix("#") { continue }

      if inModules {
        if trimmed.hasPrefix("- id:") {
          if let m = currentModule {
            modules.append(
              ModuleMeta(
                id: m.id, name: m.name, timeHours: m.hours, prerequisites: m.prereqs,
                topics: m.topics))
          }
          let val = String(trimmed.dropFirst(5)).trimmingCharacters(in: .whitespaces)
          currentModule = (Int(val) ?? 0, "", 0, [], [])
        } else if let m = currentModule {
          if trimmed.hasPrefix("name:") {
            let name = String(trimmed.dropFirst(5)).trimmingCharacters(in: .whitespaces)
              .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            currentModule = (m.id, name, m.hours, m.prereqs, m.topics)
          } else if trimmed.hasPrefix("time_hours:") {
            let hours =
              Double(String(trimmed.dropFirst(11)).trimmingCharacters(in: .whitespaces)) ?? 0
            currentModule = (m.id, m.name, hours, m.prereqs, m.topics)
          } else if trimmed.hasPrefix("prerequisites:") {
            let prereqStr = String(trimmed.dropFirst(14)).trimmingCharacters(in: .whitespaces)
            if prereqStr.hasPrefix("[") {
              let cleaned = prereqStr.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
              let nums = cleaned.components(separatedBy: ",").compactMap {
                Int($0.trimmingCharacters(in: .whitespaces))
              }
              currentModule = (m.id, m.name, m.hours, nums, m.topics)
            }
          } else if trimmed.hasPrefix("topics:") {
            let topicStr = String(trimmed.dropFirst(7)).trimmingCharacters(in: .whitespaces)
            if topicStr.hasPrefix("[") {
              let cleaned = topicStr.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
              let topics = cleaned.components(separatedBy: ",").map {
                $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(
                  in: CharacterSet(charactersIn: "\"'"))
              }
              currentModule = (m.id, m.name, m.hours, m.prereqs, topics)
            }
          }
        }
        continue
      }

      if trimmed.hasPrefix("subject:") {
        subject = String(trimmed.dropFirst(8)).trimmingCharacters(in: .whitespaces)
          .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        inObjectives = false
        inPrereqs = false
        continue
      }
      if trimmed.hasPrefix("time_budget_hours:") {
        timeBudget = Int(String(trimmed.dropFirst(18)).trimmingCharacters(in: .whitespaces)) ?? 40
        inObjectives = false
        inPrereqs = false
        continue
      }
      if trimmed.hasPrefix("target_level:") {
        targetLevel = String(trimmed.dropFirst(13)).trimmingCharacters(in: .whitespaces)
          .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        inObjectives = false
        inPrereqs = false
        continue
      }
      if trimmed.hasPrefix("domain:") {
        domain = String(trimmed.dropFirst(7)).trimmingCharacters(in: .whitespaces)
          .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        inObjectives = false
        inPrereqs = false
        continue
      }
      if trimmed.hasPrefix("prerequisites:") {
        inPrereqs = true
        inObjectives = false
        continue
      }
      if trimmed.hasPrefix("learning_objectives:") {
        inObjectives = true
        inPrereqs = false
        continue
      }
      if trimmed.hasPrefix("modules:") {
        inModules = true
        inObjectives = false
        inPrereqs = false
        continue
      }

      if inPrereqs, trimmed.hasPrefix("-") {
        prereqs.append(
          String(trimmed.dropFirst(1)).trimmingCharacters(in: .whitespaces).trimmingCharacters(
            in: CharacterSet(charactersIn: "\"'")))
        continue
      }

      if inObjectives, trimmed.hasPrefix("-") {
        objectives.append(
          String(trimmed.dropFirst(1)).trimmingCharacters(in: .whitespaces).trimmingCharacters(
            in: CharacterSet(charactersIn: "\"'")))
        continue
      }
    }
    if let m = currentModule {
      modules.append(
        ModuleMeta(
          id: m.id, name: m.name, timeHours: m.hours, prerequisites: m.prereqs, topics: m.topics))
    }

    guard !subject.isEmpty else { return nil }
    return Subject(
      id: directory,
      subject: subject,
      timeBudgetHours: timeBudget,
      targetLevel: targetLevel,
      domain: domain,
      prerequisites: prereqs,
      learningObjectives: objectives,
      modules: modules
    )
  }
}

struct ModuleMeta: Codable, Identifiable, Hashable {
  let id: Int
  let name: String
  let timeHours: Double
  let prerequisites: [Int]
  let topics: [String]
}
