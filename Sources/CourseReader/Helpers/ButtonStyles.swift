import SwiftUI

extension View {
  func primaryButton() -> some View {
    self.buttonStyle(.borderedProminent)
      .controlSize(.large)
      .buttonBorderShape(.roundedRectangle(radius: DesignConstants.CornerRadius.medium))
  }

  func secondaryButton() -> some View {
    self.buttonStyle(.bordered)
      .controlSize(.regular)
      .buttonBorderShape(.roundedRectangle(radius: DesignConstants.CornerRadius.medium))
  }

  func inlineButton() -> some View {
    self.buttonStyle(.plain)
      .font(.subheadline)
      .foregroundStyle(Color.accentColor)
  }
}
