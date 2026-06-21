import SwiftUI

extension View {
  func cardBackground(cornerRadius: CGFloat = DesignConstants.CornerRadius.large) -> some View {
    self.background(
      AppColors.cardBg,
      in: RoundedRectangle(cornerRadius: cornerRadius)
    )
  }

  func sectionBackground(cornerRadius: CGFloat = DesignConstants.CornerRadius.extraLarge)
    -> some View
  {
    self.background(
      AppColors.sectionBg,
      in: RoundedRectangle(cornerRadius: cornerRadius)
    )
  }

  func rowBackground(cornerRadius: CGFloat = DesignConstants.CornerRadius.small) -> some View {
    self.background(
      AppColors.rowBg,
      in: RoundedRectangle(cornerRadius: cornerRadius)
    )
  }

  func badgeBackground() -> some View {
    self.background(
      AppColors.badgeBg,
      in: Capsule()
    )
  }
}
