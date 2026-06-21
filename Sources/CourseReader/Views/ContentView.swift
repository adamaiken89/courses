import SwiftUI

struct ContentView: View {
  @Environment(CourseViewModel.self)
  private var viewModel

  var body: some View {
    NavigationStack(path: Bindable(viewModel).navigationPath) {
      SubjectListView()
        .environment(viewModel)
        .navigationDestination(for: AppScreen.self) { screen in
          destination(for: screen)
        }
    }
    .frame(
      minWidth: DesignConstants.Size.windowMinWidth, minHeight: DesignConstants.Size.windowMinHeight
    )
  }

  @ViewBuilder
  private func destination(for screen: AppScreen) -> some View {
    switch screen {
    case .subjectList:
      SubjectListView()

    case .reader(let subject):
      ReaderView(subject: subject)

    case .lesson(let subject, let module):
      LessonView(subject: subject, module: module)

    case .quiz(let subject, let module):
      QuizView(subject: subject, module: module)

    case .askAI(_, _):
      AskAIView(selectedText: "")

    case .review(let subject):
      ReviewView(subject: subject)

    case .settings:
      SettingsView()
    }
  }
}
