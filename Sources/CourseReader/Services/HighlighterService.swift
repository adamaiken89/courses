import AppKit
import Highlighter

@MainActor
final class HighlighterService {
  static let shared = HighlighterService()
  private let highlighter: Highlighter

  private init() {
    highlighter = Highlighter()!
    highlighter.setTheme("github-dark")
  }

  var themeBackgroundColor: NSColor {
    highlighter.theme.themeBackgroundColour ?? NSColor.controlBackgroundColor
  }

  func highlight(_ code: String, language: String?, fontSize: CGFloat) -> NSAttributedString {
    highlighter.theme.setCodeFont(
      NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular))

    let lang = language?.isEmpty == true ? nil : language
    guard let result = highlighter.highlight(code, as: lang) else {
      return NSAttributedString(
        string: code,
        attributes: [
          .font: NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular),
          .foregroundColor: NSColor.labelColor,
        ])
    }
    return result
  }

  func updateTheme(for view: NSView) {
    let isDark = view.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    highlighter.setTheme(isDark ? "github-dark" : "atom-one-light")
  }
}
