import SwiftUI

struct ReaderView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject

  var body: some View {
    HSplitView {
      readerSidebar
        .frame(minWidth: 220, maxWidth: 300)

      readerContent
        .frame(minWidth: 400, maxWidth: .infinity)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .navigationTitle(subject.displayName)
    .toolbar {
      ToolbarItem {
        Button(action: startQuiz) {
          Label("Quiz", systemImage: "checkmark.circle")
        }
        .help("Take quiz for current module")
        .disabled(viewModel.readerSelectedModule == nil)
      }
      ToolbarItem {
        Button(action: startReview) {
          Label("Review", systemImage: "arrow.counterclockwise")
        }
        .help("SRS review")
      }
    }
  }

  private var readerSidebar: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: DesignConstants.Spacing.zero) {
        subjectHeader
        moduleList
      }
    }
    .background(VisualEffectBackground())
  }

  private var subjectHeader: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      Text(subject.displayName)
        .font(DesignConstants.Font.headline)
        .fontWeight(.bold)

      Text("\(subject.modules.count) modules \u{2022} \(subject.timeBudgetHours)h")
        .font(.caption)
        .foregroundStyle(AppColors.secondaryLabel)
    }
    .padding(DesignConstants.Padding.group)
    .padding(.bottom, DesignConstants.Padding.extraCompact)
  }

  private var moduleList: some View {
    LazyVStack(alignment: .leading, spacing: DesignConstants.Spacing.zero) {
      ForEach(subject.modules) { module in
        moduleRow(module)
      }
    }
  }

  private func moduleRow(_ module: ModuleMeta) -> some View {
    let isSelected = viewModel.readerSelectedModule?.id == module.id
    let sections = isSelected ? viewModel.readerSections : []

    return VStack(alignment: .leading, spacing: DesignConstants.Spacing.zero) {
      Button(action: { viewModel.selectReaderModule(module) }) {
        HStack(spacing: DesignConstants.Spacing.sectionHeader) {
          VStack(alignment: .leading, spacing: DesignConstants.Spacing.labelPair) {
            Text("Module \(module.id)")
              .font(.caption2)
              .foregroundStyle(Color.accentColor)
              .fontWeight(.semibold)

            Text(module.name)
              .font(.subheadline)
              .fontWeight(isSelected ? .semibold : .regular)
              .lineLimit(2)
          }

          Spacer(minLength: DesignConstants.Spacing.relatedContent)

          Text(String(format: "%.1fh", module.timeHours))
            .font(.caption2)
            .foregroundStyle(AppColors.secondaryLabel)
        }
        .padding(.horizontal, DesignConstants.Padding.group)
        .padding(.vertical, DesignConstants.Padding.card)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .background(isSelected ? AppColors.rowBg : Color.clear)
      .overlay(
        isSelected
          ? Rectangle().fill(Color.accentColor).frame(width: 3).frame(maxWidth: .infinity, alignment: .leading)
          : nil, alignment: .leading
      )

      if isSelected && !sections.isEmpty {
        sectionList(sections)
      }
    }
  }

  private func sectionList(_ sections: [ModuleSection]) -> some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.zero) {
      ForEach(sections) { section in
        Button(action: { viewModel.scrollReaderToSection(section) }) {
          HStack(spacing: DesignConstants.Spacing.sectionHeader) {
            Rectangle()
              .fill(AppColors.secondaryLabel)
              .frame(width: 1, height: 12)

            Text(section.heading)
              .font(.caption)
              .foregroundStyle(AppColors.secondaryLabel)
              .lineLimit(1)
          }
          .padding(.leading, DesignConstants.Padding.group + 16)
          .padding(.trailing, DesignConstants.Padding.group)
          .padding(.vertical, DesignConstants.Padding.verticalTight)
          .frame(maxWidth: .infinity, alignment: .leading)
          .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(section.heading)
      }
      .padding(.bottom, DesignConstants.Padding.extraCompact)
    }
  }

  private var readerContent: some View {
    Group {
      if let module = viewModel.readerSelectedModule {
        LessonView(
          subject: subject,
          module: module,
          scrollTarget: Bindable(viewModel).readerScrollTarget
        )
      } else {
        VStack(spacing: DesignConstants.Spacing.pageSection) {
          Image(systemName: "book")
            .font(.largeTitle)
            .foregroundStyle(AppColors.secondaryLabel)
          Text("Select a module to begin reading")
            .font(.headline)
            .foregroundStyle(AppColors.secondaryLabel)
        }
      }
    }
  }

  private func startQuiz() {
    guard let module = viewModel.readerSelectedModule else { return }
    viewModel.startQuiz(subject: subject, module: module)
  }

  private func startReview() {
    viewModel.startReview(subject: subject)
  }
}
