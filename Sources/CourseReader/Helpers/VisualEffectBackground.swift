import SwiftUI

struct VisualEffectBackground: NSViewRepresentable {
  func makeNSView(context: Context) -> NSVisualEffectView {
    let view = NSVisualEffectView()
    view.blendingMode = .behindWindow
    view.state = .active
    view.material = .headerView
    return view
  }

  func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}

extension View {
  func windowVisualEffect() -> some View {
    self.background(VisualEffectBackground())
  }
}
