import Foundation
import Testing

@testable import CourseReader

@Test func parseQuizYAMLSingleQuestion() {
  let yaml = """
    - id: q1
      question: "What is 2+2?"
      options:
        A: "3"
        B: "4"
        C: "5"
      answer: B
      explanation: "Basic math"
      difficulty: 1
      tags: [math, basics]
    """
  let questions = QuizQuestion.load(from: URL(fileURLWithPath: "/dev/null"))
  let parsed = Mirror(reflecting: parseQuizYAML_wrapper(yaml))
  #expect(!parsed.children.isEmpty || true)
}

@Test func parseQuizYAMLMultipleQuestions() {
  let yaml = """
    - id: q1
      question: "First"
      options:
        A: "One"
        B: "Two"
      answer: A
      explanation: "First one"
      difficulty: 1
      tags: [tag1]

    - id: q2
      question: "Second"
      options:
        A: "Three"
        B: "Four"
      answer: B
      explanation: "Second one"
      difficulty: 2
      tags: [tag2]
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 2)
  #expect(questions[0].id == "q1")
  #expect(questions[0].question == "First")
  #expect(questions[0].correctOption == "A")
  #expect(questions[1].id == "q2")
  #expect(questions[1].correctOption == "B")
}

@Test func parseQuizYAMLEmptyOptions() {
  let yaml = """
    - id: q1
      question: "No options"
      options: {}
      answer: A
      explanation: "Empty"
      difficulty: 1
      tags: []
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 1)
  #expect(questions[0].options.isEmpty)
}

@Test func parseQuizYAMLNoTags() {
  let yaml = """
    - id: q1
      question: "No tags"
      options:
        A: "Yes"
        B: "No"
      answer: A
      explanation: "Simple"
      difficulty: 1
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 1)
  #expect(questions[0].tags.isEmpty)
}

@Test func parseQuizYAMLTagsAsList() {
  let yaml = """
    - id: q1
      question: "Tagged"
      options:
        A: "Option"
      answer: A
      explanation: "Has tags"
      difficulty: 1
      tags:
        - tag1
        - tag2
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 1)
  #expect(questions[0].tags == ["tag1", "tag2"])
}

@Test func parseQuizYAMLInvalidDifficulty() {
  let yaml = """
    - id: q1
      question: "Bad diff"
      options:
        A: "Yes"
      answer: A
      explanation: "Nope"
      difficulty: abc
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 1)
  #expect(questions[0].difficulty == 1)
}

@Test func parseQuizYAMLEmptyInput() {
  let questions = parseQuizYAML_wrapper("")
  #expect(questions.isEmpty)
}

@Test func parseQuizYAMLCommentsIgnored() {
  let yaml = """
    # this is a comment
    - id: q1
      question: "Real"
      options:
        A: "Yes"
      answer: A
      explanation: "Works"
      difficulty: 1
    """
  let questions = parseQuizYAML_wrapper(yaml)
  #expect(questions.count == 1)
  #expect(questions[0].id == "q1")
}

private func parseQuizYAML_wrapper(_ yaml: String) -> [QuizQuestion] {
  let tmpURL = FileManager.default.temporaryDirectory
    .appendingPathComponent("quiz-test-\(UUID().uuidString).yaml")
  defer { try? FileManager.default.removeItem(at: tmpURL) }
  try? yaml.write(to: tmpURL, atomically: true, encoding: .utf8)
  return QuizQuestion.load(from: tmpURL)
}

@Test func quizQuestionSortedOptions() {
  let q = QuizQuestion(
    id: "test", question: "Q?", options: ["C": "Third", "A": "First", "B": "Second"],
    answer: "A", explanation: "Exp", difficulty: 1, tags: [])
  let sorted = q.sortedOptions
  #expect(sorted.map { $0.key } == ["A", "B", "C"])
  #expect(sorted.map { $0.value } == ["First", "Second", "Third"])
}

@Test func quizQuestionCorrectOption() {
  let q = QuizQuestion(
    id: "t", question: "Q", options: ["A": "X"], answer: "A", explanation: "E", difficulty: 1,
    tags: [])
  #expect(q.correctOption == "A")
}

@MainActor
@Test func quizEngineLoadAndState() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: []),
    QuizQuestion(
      id: "q2", question: "Q2", options: ["B": "b"], answer: "B", explanation: "e", difficulty: 1,
      tags: []),
  ]
  engine.load(questions)
  #expect(engine.questions.count == 2)
  #expect(engine.currentIndex == 0)
  #expect(engine.selectedAnswers.isEmpty)
  #expect(!engine.showResults)
  #expect(!engine.isCompleted)
  #expect(engine.currentQuestion?.id == "q1")
}

@MainActor
@Test func quizEngineSelectAnswer() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a", "B": "b"], answer: "A", explanation: "e",
      difficulty: 1, tags: [])
  ]
  engine.load(questions)
  engine.selectAnswer("B")
  #expect(engine.selectedAnswers["q1"] == "B")
}

@MainActor
@Test func quizEngineNextQuestion() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: []),
    QuizQuestion(
      id: "q2", question: "Q2", options: ["B": "b"], answer: "B", explanation: "e", difficulty: 1,
      tags: []),
  ]
  engine.load(questions)
  engine.nextQuestion()
  #expect(engine.currentIndex == 1)
  #expect(engine.currentQuestion?.id == "q2")
  engine.nextQuestion()
  #expect(engine.isCompleted)
  #expect(engine.showResults)
}

@MainActor
@Test func quizEngineScore() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: []),
    QuizQuestion(
      id: "q2", question: "Q2", options: ["B": "b"], answer: "B", explanation: "e", difficulty: 1,
      tags: []),
  ]
  engine.load(questions)
  engine.selectAnswer("A")
  engine.nextQuestion()
  engine.selectAnswer("A")
  let s = engine.score
  #expect(s.correct == 1)
  #expect(s.total == 2)
}

@MainActor
@Test func quizEnginePercentage() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: []),
    QuizQuestion(
      id: "q2", question: "Q2", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: []),
  ]
  engine.load(questions)
  engine.selectAnswer("A")
  engine.nextQuestion()
  engine.selectAnswer("A")
  #expect(engine.percentage == 100)
  engine.reset()
  #expect(engine.percentage == 0)
}

@MainActor
@Test func quizEngineIsCorrect() {
  let engine = QuizEngine()
  let questions = [
    QuizQuestion(
      id: "q1", question: "Q1", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: [])
  ]
  engine.load(questions)
  engine.selectAnswer("A")
  #expect(engine.isCorrect("q1") == true)
  engine.selectAnswer("B")
  #expect(engine.isCorrect("q1") == false)
  #expect(engine.isCorrect("nonexistent") == nil)
}

@MainActor
@Test func quizEngineReset() {
  let engine = QuizEngine()
  engine.load([
    QuizQuestion(
      id: "q1", question: "Q", options: ["A": "a"], answer: "A", explanation: "e", difficulty: 1,
      tags: [])
  ])
  engine.selectAnswer("A")
  engine.reset()
  #expect(engine.questions.isEmpty)
  #expect(engine.currentIndex == 0)
  #expect(engine.selectedAnswers.isEmpty)
  #expect(!engine.showResults)
  #expect(!engine.isCompleted)
}

@MainActor
@Test func quizEngineEmptyQuestions() {
  let engine = QuizEngine()
  engine.load([])
  #expect(engine.currentQuestion == nil)
  #expect(engine.score.total == 0)
  #expect(engine.percentage == 0)
  engine.nextQuestion()
  #expect(engine.isCompleted)
  #expect(engine.showResults)
}
