import SwiftUI

enum AppColors {
  static let accent = Color.accentColor
  static let secondaryLabel = Color.secondary
  static let titleText = Color.primary
  static let bodyText = Color.primary
  static let cardBg = Color(nsColor: .textBackgroundColor)
  static let sectionBg = Color(nsColor: .textBackgroundColor)
  static let rowBg = Color(nsColor: .controlBackgroundColor).opacity(1.0)
  static let badgeBg = Color(nsColor: .controlBackgroundColor).opacity(1.0)
  static let highlightBg = Color.yellow
  static let correctGreen = Color.green
  static let incorrectRed = Color.red
  static let quizOptionBorder = Color(nsColor: .separatorColor)
  static let quizOptionSelected = Color.accentColor
  static let quizOptionHover = Color.accentColor
  static let aiBubbleBg = Color(nsColor: .controlBackgroundColor).opacity(1.0)
  static let aiUserBubble = Color.accentColor
}
