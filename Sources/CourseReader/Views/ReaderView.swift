import SwiftUI

struct ReaderView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject

  var body: some View {
    HSplitView {
      readerSidebar
        .frame(
          minWidth: DesignConstants.Size.sidebarMinWidth,
          maxWidth: DesignConstants.Size.sidebarMaxWidth)

      readerContent
        .frame(minWidth: DesignConstants.Size.contentMinWidth, maxWidth: .infinity)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .navigationTitle(subject.displayName)
    .toolbar {
      ToolbarItem {
        Button(action: startReview) {
          Label(loc("Review"), systemImage: "arrow.counterclockwise")
        }
        .help(loc("SRS review"))
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
  }

  private var subjectHeader: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      Text(subject.displayName)
        .font(DesignConstants.Font.headline)
        .fontWeight(.bold)

      Text("\(loc("\(subject.modules.count) modules")) \u{2022} \(subject.timeBudgetHours)h")
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
            Text(loc("Module \(module.id)"))
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
          ? Rectangle().fill(Color.accentColor).frame(
            width: DesignConstants.Size.selectionIndicator
          ).frame(
            maxWidth: .infinity, alignment: .leading)
          : nil, alignment: .leading
      )

      if isSelected && !sections.isEmpty {
        sectionList(sections)
      }
    }
  }

  private func sectionList(_ sections: [ModuleSection]) -> some View {
    let activeIds: Set<String> = {
      guard let current = viewModel.readerVisibleSectionId,
            let idx = sections.firstIndex(where: { $0.id == current })
      else { return [] }
      var ids: Set<String> = [current]
      var ancestorLevel = sections[idx].level
      for i in (0..<idx).reversed() where ancestorLevel > 1 {
        let s = sections[i]
        if s.level < ancestorLevel {
          ids.insert(s.id)
          ancestorLevel = s.level
        }
      }
      return ids
    }()
    return VStack(alignment: .leading, spacing: DesignConstants.Spacing.zero) {
      ForEach(sections) { section in
        let isActive = activeIds.contains(section.id)
        let isSubSection = section.level >= 3
        let leadingIndent =
          isSubSection
          ? DesignConstants.Padding.sectionIndent + DesignConstants.Padding.sectionSubIndent
          : DesignConstants.Padding.sectionIndent

        Button(action: { viewModel.scrollReaderToSection(section) }) {
          HStack(spacing: DesignConstants.Spacing.sectionHeader) {
            Rectangle()
              .fill(isActive ? Color.accentColor : AppColors.secondaryLabel)
              .frame(
                width: DesignConstants.Size.sectionBulletWidth,
                height: isSubSection
                  ? DesignConstants.Size.sectionBulletHeight - 2
                  : DesignConstants.Size.sectionBulletHeight)

            Text(section.heading)
              .font(isSubSection ? .caption2 : .caption)
              .foregroundStyle(isActive ? Color.accentColor : AppColors.secondaryLabel)
              .fontWeight(isActive ? .semibold : .regular)
              .lineLimit(1)
          }
          .padding(.leading, leadingIndent)
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
          scrollTarget: Bindable(viewModel).readerScrollTarget,
          visibleSectionId: Bindable(viewModel).readerVisibleSectionId
        )
      } else {
        VStack(spacing: DesignConstants.Spacing.pageSection) {
          Image(systemName: "book")
            .font(.largeTitle)
            .foregroundStyle(AppColors.secondaryLabel)
          Text(loc("Select a module to begin reading"))
            .font(.headline)
            .foregroundStyle(AppColors.secondaryLabel)
        }
      }
    }
    .transition(
      .asymmetric(
        insertion: .opacity.combined(with: .move(edge: .trailing)),
        removal: .opacity.combined(with: .move(edge: .leading))
      )
    )
    .animation(.easeInOut(duration: 0.35), value: viewModel.readerSelectedModule?.id)
  }

  private func startReview() {
    viewModel.startReview(subject: subject)
  }
}
