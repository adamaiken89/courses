import SwiftUI

struct QuizView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject
  let module: ModuleMeta

  var body: some View {
    VStack(spacing: DesignConstants.Spacing.zero) {
      if viewModel.quizEngine.isCompleted {
        quizResults
      } else if let question = viewModel.quizEngine.currentQuestion {
        quizContent(question)
      } else {
        emptyState
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(VisualEffectBackground())
  }

  private var quizResults: some View {
    VStack(spacing: DesignConstants.Spacing.pageWide) {
      Image(
        systemName: viewModel.quizEngine.percentage >= 70
          ? "checkmark.circle.fill"
          : "xmark.circle.fill"
      )
      .font(.system(size: DesignConstants.FontSize.quizIcon))
      .foregroundStyle(
        viewModel.quizEngine.percentage >= 70
          ? AppColors.correctGreen
          : AppColors.incorrectRed)

      Text(viewModel.quizEngine.percentage >= 70 ? loc("Quiz Passed") : loc("Keep Studying"))
        .font(DesignConstants.Font.title)
        .fontWeight(.bold)

      VStack(spacing: DesignConstants.Spacing.relatedContent) {
        Text(
          loc("Score: \(viewModel.quizEngine.score.correct)/\(viewModel.quizEngine.score.total)")
        )
        .font(.title2)

        Text(String(format: "%.0f%%", viewModel.quizEngine.percentage))
          .font(.largeTitle)
          .fontWeight(.bold)
          .foregroundStyle(
            viewModel.quizEngine.percentage >= 70
              ? AppColors.correctGreen
              : AppColors.incorrectRed)
      }

      ScrollView {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
          ForEach(viewModel.quizEngine.questions) { question in
            QuestionReviewCard(
              question: question, selected: viewModel.quizEngine.selectedAnswers[question.id] ?? "")
          }
        }
        .padding(DesignConstants.Padding.group)
      }

      HStack(spacing: DesignConstants.Spacing.pageSection) {
        Button(loc("Back to Lesson")) {
          viewModel.goBack()
        }
        .secondaryButton()

        Button(loc("Retake Quiz")) {
          viewModel.quizEngine.load(viewModel.quizEngine.questions)
        }
        .primaryButton()
      }
    }
    .padding(DesignConstants.Padding.group)
  }

  private func quizContent(_ question: QuizQuestion) -> some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
      progressHeader
      questionCard(question)
      Spacer()
    }
    .padding(DesignConstants.Padding.group)
  }

  private var progressHeader: some View {
    HStack {
      Text(loc("Module Quiz"))
        .font(DesignConstants.Font.headline)
        .fontWeight(.bold)

      Spacer()

      Text(
        loc("\(viewModel.quizEngine.currentIndex + 1) of \(viewModel.quizEngine.questions.count)")
      )
      .font(.subheadline)
      .foregroundStyle(AppColors.secondaryLabel)
      .monospacedDigit()
    }
    .padding(.bottom, DesignConstants.Padding.section)
  }

  private var emptyState: some View {
    Text(loc("No questions available."))
      .foregroundStyle(AppColors.secondaryLabel)
  }
}

extension QuizView {
  func questionCard(_ question: QuizQuestion) -> some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
      HStack {
        ForEach(question.tags.prefix(3), id: \.self) { tag in
          Text(tag)
            .font(.caption2)
            .padding(.horizontal, DesignConstants.Padding.horizontalTight)
            .padding(.vertical, DesignConstants.Padding.verticalCompact)
            .badgeBackground()
        }

        Spacer()

        difficultyBadge(question.difficulty)
      }

      Text(question.question)
        .font(.body)
        .fontWeight(.medium)
        .padding(.vertical, DesignConstants.Padding.extraCompact)

      VStack(spacing: DesignConstants.Spacing.relatedContent) {
        ForEach(question.sortedOptions, id: \.key) { key, value in
          OptionRow(
            label: key,
            text: value,
            isSelected: viewModel.quizEngine.selectedAnswers[question.id] == key,
            isCorrect: viewModel.quizEngine.isCompleted
              ? (key == question.correctOption) : nil,
            action: {
              viewModel.quizEngine.selectAnswer(key)
            }
          )
        }
      }

      if let selected = viewModel.quizEngine.selectedAnswers[question.id],
        !viewModel.quizEngine.isCompleted
      {
        VStack(spacing: DesignConstants.Spacing.sectionGroup) {
          Text(question.explanation)
            .font(.subheadline)
            .foregroundStyle(AppColors.secondaryLabel)
            .padding(DesignConstants.Padding.group)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
              AppColors.aiUserBubble,
              in: RoundedRectangle(cornerRadius: DesignConstants.CornerRadius.medium))

          HStack {
            Spacer()
            Button(selected == question.correctOption ? loc("Next Question") : loc("Continue")) {
              withAnimation {
                viewModel.quizEngine.nextQuestion()
              }
            }
            .primaryButton()
          }
        }
      }
    }
    .padding(DesignConstants.Padding.card)
    .cardBackground()
  }

  func difficultyBadge(_ level: Int) -> some View {
    let colors: [Color] = [
      AppColors.correctGreen, AppColors.secondaryLabel, AppColors.incorrectRed,
    ]
    let labels = [loc("Easy"), loc("Medium"), loc("Hard")]
    let idx = min(level - 1, 2)
    return Text(labels[idx])
      .font(.caption2)
      .foregroundStyle(colors[idx])
      .padding(.horizontal, DesignConstants.Padding.horizontalTight)
      .padding(.vertical, DesignConstants.Padding.verticalCompact)
      .background(colors[idx], in: Capsule())
  }
}

struct OptionRow: View {
  let label: String
  let text: String
  let isSelected: Bool
  let isCorrect: Bool?
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: DesignConstants.Spacing.sectionGroup) {
        Text(label)
          .font(.subheadline)
          .fontWeight(.semibold)
          .foregroundStyle(foregroundColor)
          .frame(
            width: DesignConstants.Size.quizCheckbox, height: DesignConstants.Size.quizCheckbox
          )
          .background(
            Circle()
              .fill(backgroundColor)
          )

        Text(text)
          .font(.body)
          .foregroundStyle(foregroundColor)
          .frame(maxWidth: .infinity, alignment: .leading)

        if let correct = isCorrect {
          Image(systemName: correct ? "checkmark.circle.fill" : "xmark.circle.fill")
            .foregroundStyle(correct ? AppColors.correctGreen : AppColors.incorrectRed)
        } else if isSelected {
          Image(systemName: "circle.fill")
            .font(.caption)
            .foregroundStyle(Color.accentColor)
        }
      }
      .padding(DesignConstants.Padding.card)
      .background(
        RoundedRectangle(cornerRadius: DesignConstants.CornerRadius.medium)
          .fill(backgroundColor)
      )
      .overlay(
        RoundedRectangle(cornerRadius: DesignConstants.CornerRadius.medium)
          .stroke(
            borderColor,
            lineWidth: isSelected
              ? DesignConstants.Padding.borderSelected : DesignConstants.Padding.border)
      )
    }
    .buttonStyle(.plain)
  }

  private var foregroundColor: Color {
    if let correct = isCorrect {
      return correct ? AppColors.correctGreen : AppColors.incorrectRed
    }
    return isSelected ? Color.accentColor : .primary
  }

  private var backgroundColor: Color {
    if let correct = isCorrect {
      return correct
        ? AppColors.correctGreen
        : AppColors.incorrectRed
    }
    return isSelected ? AppColors.quizOptionSelected : AppColors.rowBg
  }

  private var borderColor: Color {
    if let correct = isCorrect {
      return correct
        ? AppColors.correctGreen
        : AppColors.incorrectRed
    }
    return isSelected
      ? Color.accentColor
      : AppColors.quizOptionBorder
  }
}

struct QuestionReviewCard: View {
  let question: QuizQuestion
  let selected: String

  var body: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      HStack {
        Image(
          systemName: selected == question.correctOption
            ? "checkmark.circle.fill"
            : "xmark.circle.fill"
        )
        .foregroundStyle(
          selected == question.correctOption
            ? AppColors.correctGreen
            : AppColors.incorrectRed)

        Text(question.question)
          .font(.subheadline)
          .fontWeight(.medium)
      }

      Text(
        loc("Correct: \(question.correctOption). \(question.options[question.correctOption] ?? "")")
      )
      .font(.caption)
      .foregroundStyle(AppColors.correctGreen)

      if selected != question.correctOption {
        Text(loc("Your answer: \(selected). \(question.options[selected] ?? "")"))
          .font(.caption)
          .foregroundStyle(AppColors.incorrectRed)
      }

      Text(question.explanation)
        .font(.caption)
        .foregroundStyle(AppColors.secondaryLabel)
        .padding(.top, DesignConstants.Padding.verticalTight)
    }
    .padding(DesignConstants.Padding.card)
    .cardBackground()
  }
}
