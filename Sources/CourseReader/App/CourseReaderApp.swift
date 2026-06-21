import SwiftUI

@main
struct CourseReaderApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @State private var viewModel = CourseViewModel.shared

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environment(viewModel)
        .windowVisualEffect()
        .frame(minWidth: 500, minHeight: 500)
        .onAppear {
          viewModel.loadSubjects()
        }
    }
    .windowResizability(.contentMinSize)
    .commands {
      CommandGroup(replacing: .appInfo) {
        Button("About Course Reader") {
          NSApplication.shared.orderFrontStandardAboutPanel(nil)
        }
      }
    }

    Settings {
      SettingsView()
        .environment(viewModel)
    }
  }
}
