import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
  func application(_ application: NSApplication, openFile filename: String) -> Bool {
    let url = URL(fileURLWithPath: filename)
    guard url.pathExtension.lowercased() == "zip" else { return false }

    guard let subjectsDir = findSubjectsDir() else { return false }

    let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    do {
      try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

      let process = Process()
      process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
      process.arguments = ["-o", url.path, "-d", tempDir.path]
      try process.run()
      process.waitUntilExit()

      guard process.terminationStatus == 0 else {
        throw NSError(
          domain: "com.coursereader", code: 1,
          userInfo: [
            NSLocalizedDescriptionKey: "unzip failed (status \(process.terminationStatus))"
          ])
      }

      let contents = try FileManager.default.contentsOfDirectory(
        at: tempDir, includingPropertiesForKeys: nil)
      guard let subjectDir = contents.first(where: { $0.hasDirectoryPath }) else {
        throw NSError(
          domain: "com.coursereader", code: 2,
          userInfo: [
            NSLocalizedDescriptionKey: "No directory found in zip"
          ])
      }

      let dirName = subjectDir.lastPathComponent
      let destURL = subjectsDir.appendingPathComponent(dirName)

      if FileManager.default.fileExists(atPath: destURL.path) {
        try FileManager.default.removeItem(at: destURL)
      }
      try FileManager.default.moveItem(at: subjectDir, to: destURL)

      try? FileManager.default.removeItem(at: tempDir)

      Task { @MainActor in
        CourseViewModel.shared.loadSubjects()
      }
      NSWorkspace.shared.activateFileViewerSelecting([destURL])
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        NSApplication.shared.terminate(nil)
      }
      return true
    } catch {
      try? FileManager.default.removeItem(at: tempDir)
      let alert = NSAlert()
      alert.alertStyle = .critical
      alert.messageText = "Import Failed"
      alert.informativeText = error.localizedDescription
      alert.runModal()
      return false
    }
  }

  private func findSubjectsDir() -> URL? {
    let possiblePaths = [
      URL(fileURLWithPath: "\(FileManager.default.currentDirectoryPath)/subjects"),
      URL(fileURLWithPath: "\(NSHomeDirectory())/Desktop/courses/subjects"),
    ]
    let bundlePath = Bundle.main.resourceURL?.appendingPathComponent("subjects")
    if let bp = bundlePath, FileManager.default.fileExists(atPath: bp.path) {
      return bp
    }
    return possiblePaths.first(where: { FileManager.default.fileExists(atPath: $0.path) })
  }
}
