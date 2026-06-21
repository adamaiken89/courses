import AppKit
import SwiftUI

enum DesignConstants {
  enum Spacing {
    static let zero: CGFloat = 0
    static let labelPair: CGFloat = 2
    static let fileList: CGFloat = 4
    static let sectionHeader: CGFloat = 6
    static let relatedContent: CGFloat = 8
    static let groupBox: CGFloat = 10
    static let sectionGroup: CGFloat = 12
    static let progressContent: CGFloat = 16
    static let pageSection: CGFloat = 20
    static let pageWide: CGFloat = 24
    static let gridRow: CGFloat = 16
  }

  enum Padding {
    static let border: CGFloat = 1
    static let borderSelected: CGFloat = 2
    static let extraCompact: CGFloat = 8
    static let card: CGFloat = 12
    static let section: CGFloat = 14
    static let group: CGFloat = 16
    static let settingsTab: CGFloat = 20
    static let dropZone: CGFloat = 48
    static let horizontalTight: CGFloat = 6
    static let horizontalDefault: CGFloat = 8
    static let verticalTight: CGFloat = 4
    static let verticalDefault: CGFloat = 6
    static let verticalCompact: CGFloat = 2
    static let verticalSmall: CGFloat = 3
    static let leadingTight: CGFloat = 4
    static let topTight: CGFloat = 8
    static let sectionIndent: CGFloat = 32
    static let sectionSubIndent: CGFloat = 16
    static let codeBlock: CGFloat = 12
  }

  enum Font {
    static let title = SwiftUI.Font.title
    static let title2 = SwiftUI.Font.title2
    static let title3 = SwiftUI.Font.title3
    static let headline = SwiftUI.Font.headline
    static let body = SwiftUI.Font.body
    static let subheadline = SwiftUI.Font.subheadline
    static let caption = SwiftUI.Font.caption
  }

  enum CornerRadius {
    static let small: CGFloat = 6
    static let medium: CGFloat = 8
    static let large: CGFloat = 10
    static let extraLarge: CGFloat = 12
  }

  enum Size {
    static let windowMinWidth: CGFloat = 500
    static let windowMinHeight: CGFloat = 500
    static let logoLarge: CGFloat = 48
    static let logoSettings: CGFloat = 32
    static let quizCheckbox: CGFloat = 24
    static let sidebarWidth: CGFloat = 320
    static let sidebarMinWidth: CGFloat = 220
    static let sidebarMaxWidth: CGFloat = 300
    static let contentMinWidth: CGFloat = 400
    static let settingsWindowWidth: CGFloat = 450
    static let settingsWindowHeight: CGFloat = 500
    static let gridCardMin: CGFloat = 280
    static let gridCardMax: CGFloat = 400
    static let selectionIndicator: CGFloat = 3
    static let sectionBulletWidth: CGFloat = 1
    static let sectionBulletHeight: CGFloat = 12
    static let gridSpacing: CGFloat = 16
    static let progressViewScale: CGFloat = 0.8
    static let scrollDetectionOffset: CGFloat = 40
  }

  enum FontSize {
    static let quizIcon: CGFloat = 64
    static let settingsLabel: CGFloat = 10
    static let settingsTitle: CGFloat = 24
    static let emptyIcon: CGFloat = 48
    static let lessonDefault: CGFloat = 17
    static let headingOffset: CGFloat = 8
    static let subheadingOffset: CGFloat = 4
    static let codeOffset: CGFloat = -1
    static let h1Offset: CGFloat = 12
    static let h4Offset: CGFloat = 2
    static let h5Offset: CGFloat = 0
    static let h6Offset: CGFloat = -2
  }

  enum HeaderColors {
    static let h1 = NSColor.controlAccentColor
    static let h2 = NSColor.labelColor
    static let h3 = NSColor.secondaryLabelColor
    static let h4 = NSColor.secondaryLabelColor
    static let h5 = NSColor.secondaryLabelColor
    static let h6 = NSColor.tertiaryLabelColor
  }

}
