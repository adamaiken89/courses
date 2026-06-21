import SwiftUI
import SwiftData

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
          try? StorageService.shared.setup()
        }
    }
    .windowResizability(.contentMinSize)
    .commands {
      CommandGroup(replacing: .appInfo) {
        Button(loc("About Course Reader")) {
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
