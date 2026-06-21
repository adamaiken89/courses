import SwiftUI

struct SettingsView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  @State private var apiKey: String = ""

  var body: some View {
    Form {
      Section {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
          Text("Google AI (Gemini) Configuration")
            .font(.headline)

          Text("Enter your Gemini API key to enable AI-powered Q&A on course content.")
            .font(.subheadline)
            .foregroundStyle(AppColors.secondaryLabel)

          SecureField("API Key", text: $apiKey)
            .textFieldStyle(.roundedBorder)
            .font(.body)
            .onAppear {
              apiKey =
                viewModel.gemini.hasAPIKey
                ? UserDefaults.standard.string(forKey: "geminiAPIKey") ?? "" : ""
            }

          HStack {
            Spacer()
            Button("Save") {
              UserDefaults.standard.set(apiKey, forKey: "geminiAPIKey")
            }
            .primaryButton()
            .disabled(apiKey.isEmpty)
          }
        }
        .padding()
      } header: {
        Text("AI Settings")
      }

      Section {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.relatedContent) {
          Text("Course Directory")
            .font(.headline)

          Text("Courses are loaded from the subjects/ directory.")
            .font(.subheadline)
            .foregroundStyle(AppColors.secondaryLabel)

          HStack {
            Text(FileManager.default.currentDirectoryPath + "/subjects")
              .font(.caption)
              .foregroundStyle(AppColors.secondaryLabel)
              .lineLimit(1)
              .truncationMode(.middle)
          }
        }
        .padding()
      } header: {
        Text("Storage")
      }

      Section {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.relatedContent) {
          Text("Lesson Font Size: \(Int(viewModel.lessonFontSize)) pt")
            .font(.headline)

          Slider(value: Bindable(viewModel).lessonFontSize, in: 10...24, step: 1) {
            Text("Font Size")
          }

          HStack {
            Text("Aa")
              .font(.system(size: DesignConstants.FontSize.settingsLabel))
              .foregroundStyle(AppColors.secondaryLabel)
            Spacer()
            Text("Aa")
              .font(.system(size: DesignConstants.FontSize.settingsTitle))
              .foregroundStyle(AppColors.secondaryLabel)
          }
        }
        .padding()
      } header: {
        Text("Display")
      }
    }
    .formStyle(.grouped)
    .frame(
      width: DesignConstants.Size.settingsWindowWidth,
      height: DesignConstants.Size.settingsWindowHeight
    )
    .overlay(alignment: .topTrailing) {
      Image("logo")
        .resizable()
        .frame(width: DesignConstants.Size.logoSettings, height: DesignConstants.Size.logoSettings)
        .clipShape(RoundedRectangle(cornerRadius: DesignConstants.CornerRadius.small))
        .padding(DesignConstants.Padding.card)
        .opacity(DesignConstants.Opacity.settingsLogo)
    }
  }
}
