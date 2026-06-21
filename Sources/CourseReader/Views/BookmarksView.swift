import SwiftUI

struct BookmarksView: View {
  @Environment(CourseViewModel.self)
  private var viewModel

  @State private var bookmarks: [Bookmark] = []

  var body: some View {
    Group {
      if bookmarks.isEmpty {
        emptyState
      } else {
        listContent
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .navigationTitle(loc("Bookmarks"))
    .onAppear {
      bookmarks = viewModel.allBookmarks()
    }
  }

  private var emptyState: some View {
    VStack(spacing: DesignConstants.Spacing.pageSection) {
      Image(systemName: "bookmark")
        .font(.largeTitle)
        .foregroundStyle(AppColors.secondaryLabel)
      Text(loc("No bookmarks yet."))
        .font(.headline)
        .foregroundStyle(AppColors.secondaryLabel)
      Text(loc("Bookmark modules while reading to find them here."))
        .font(.subheadline)
        .foregroundStyle(AppColors.secondaryLabel)
    }
  }

  private var listContent: some View {
    ScrollView {
      LazyVStack(spacing: DesignConstants.Spacing.sectionHeader) {
        ForEach(bookmarks, id: \.id) { bookmark in
          bookmarkRow(bookmark)
        }
      }
      .padding(DesignConstants.Padding.group)
    }
  }

  private func bookmarkRow(_ bookmark: Bookmark) -> some View {
    Button(action: { viewModel.openReaderToBookmark(subjectID: bookmark.subjectID, moduleID: bookmark.moduleID) }) {
      VStack(alignment: .leading, spacing: DesignConstants.Spacing.labelPair) {
        Text(bookmark.title)
          .font(.subheadline)
          .fontWeight(.semibold)
          .foregroundStyle(AppColors.bodyText)
          .lineLimit(2)

        Text(bookmark.subjectID)
          .font(.caption2)
          .foregroundStyle(AppColors.secondaryLabel)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(DesignConstants.Padding.card)
      .cardBackground()
    }
    .buttonStyle(.plain)
  }
}
