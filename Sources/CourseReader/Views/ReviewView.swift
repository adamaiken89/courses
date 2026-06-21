import SwiftUI

struct ReviewView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject

  var body: some View {
    VStack(spacing: DesignConstants.Spacing.zero) {
      header
      filterBar
      cardList
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(VisualEffectBackground())
  }

  private var header: some View {
    HStack {
      Text(loc("Spaced Repetition Review"))
        .font(DesignConstants.Font.title2)
        .fontWeight(.bold)

      Spacer()

      Button(loc("Back")) {
        viewModel.goBack()
      }
      .secondaryButton()
    }
    .padding(DesignConstants.Padding.group)
  }

  private var filterBar: some View {
    HStack(spacing: DesignConstants.Spacing.sectionHeader) {
      ForEach(ReviewFilter.allCases, id: \.self) { filter in
        Button(filter.label) {
          viewModel.reviewFilter = filter
        }
        .buttonStyle(.plain)
        .font(.subheadline)
        .fontWeight(viewModel.reviewFilter == filter ? .bold : .regular)
        .foregroundStyle(
          viewModel.reviewFilter == filter ? Color.accentColor : AppColors.secondaryLabel
        )
        .padding(.horizontal, DesignConstants.Padding.horizontalDefault)
        .padding(.vertical, DesignConstants.Padding.verticalCompact)
        .background(
          viewModel.reviewFilter == filter
            ? Color.accentColor.opacity(0.12)
            : Color.clear,
          in: Capsule()
        )
      }
    }
    .padding(.horizontal, DesignConstants.Padding.group)
    .padding(.bottom, DesignConstants.Padding.section)
  }

  @ViewBuilder
  private var cardList: some View {
    let cards = viewModel.displayedCards

    if cards.isEmpty {
      emptyState
    } else {
      ScrollView {
        LazyVStack(spacing: DesignConstants.Spacing.sectionHeader) {
          ForEach(cards) { card in
            CardRow(card: card, onToggleStar: {
              viewModel.toggleStar(cardId: card.id)
            })
          }
        }
        .padding(DesignConstants.Padding.group)
      }
    }
  }

  private var emptyState: some View {
    VStack(spacing: DesignConstants.Spacing.pageSection) {
      Spacer()
      Image(systemName: "sparkles.rectangle.stack")
        .font(.system(size: DesignConstants.FontSize.emptyIcon))
        .foregroundStyle(AppColors.secondaryLabel)

      Text(emptyMessage)
        .foregroundStyle(AppColors.secondaryLabel)
      Spacer()
    }
  }

  private var emptyMessage: String {
    switch viewModel.reviewFilter {
    case .all: return loc("No cards yet. Complete quizzes to generate cards.")
    case .due: return loc("No cards due for review.")
    case .starred: return loc("No starred cards. Tap the star on a card to add it.")
    }
  }
}

private struct CardRow: View {
  let card: SRSCard
  let onToggleStar: () -> Void
  @State private var showAnswer = false

  var body: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      HStack(alignment: .top) {
        Text(card.question)
          .font(.body)
          .fontWeight(.medium)
          .frame(maxWidth: .infinity, alignment: .leading)

        Button(action: onToggleStar) {
          Image(systemName: card.isStarred ? "star.fill" : "star")
            .foregroundStyle(card.isStarred ? Color.accentColor : AppColors.secondaryLabel)
        }
        .buttonStyle(.plain)
      }

      if showAnswer {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.relatedContent) {
          Text(card.answer)
            .font(.subheadline)
            .foregroundStyle(AppColors.correctGreen)

          if !card.explanation.isEmpty {
            Text(card.explanation)
              .font(.caption)
              .foregroundStyle(AppColors.secondaryLabel)
          }
        }
        .transition(.opacity.combined(with: .move(edge: .top)))
      }

      HStack {
        Button(showAnswer ? loc("Hide Answer") : loc("Show Answer")) {
          withAnimation { showAnswer.toggle() }
        }
        .inlineButton()

        Spacer()

        Text(dueLabel)
          .font(.caption)
          .foregroundStyle(dueColor)
      }
    }
    .padding(DesignConstants.Padding.card)
    .cardBackground()
  }

  private var dueLabel: String {
    if card.isDue {
      return loc("Due now")
    }
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .abbreviated
    return formatter.localizedString(for: card.nextReviewDate, relativeTo: Date())
  }

  private var dueColor: Color {
    card.isDue ? AppColors.incorrectRed : AppColors.secondaryLabel
  }
}

extension ReviewFilter {
  var label: String {
    switch self {
    case .all: return String(localized: "All", bundle: .module)
    case .due: return String(localized: "Due", bundle: .module)
    case .starred: return String(localized: "Starred", bundle: .module)
    }
  }
}
