import Foundation

@MainActor
final class GeminiService {
  static let shared = GeminiService()

  private let baseURL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

  private var apiKey: String {
    UserDefaults.standard.string(forKey: "geminiAPIKey") ?? ""
  }

  var hasAPIKey: Bool {
    !apiKey.isEmpty
  }

  struct RequestBody: Codable {
    let contents: [Content]

    struct Content: Codable {
      let parts: [Part]

      struct Part: Codable {
        let text: String
      }
    }
  }

  struct ResponseBody: Codable {
    let candidates: [Candidate]?

    struct Candidate: Codable {
      let content: Content?

      struct Content: Codable {
        let parts: [Part]?

        struct Part: Codable {
          let text: String?
        }
      }
    }
  }

  func ask(question: String, context: String) async throws -> String {
    guard !apiKey.isEmpty else {
      throw GeminiError.noAPIKey
    }

    let prompt = """
      You are a tutor helping understand course material.

      Context from the course:
      \(context)

      Question from the student:
      \(question)

      Provide a clear, concise explanation. Use examples where helpful.
      """

    var request = URLRequest(url: URL(string: "\(baseURL)?key=\(apiKey)")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = RequestBody(
      contents: [RequestBody.Content(parts: [RequestBody.Content.Part(text: prompt)])]
    )
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else {
      throw GeminiError.networkError
    }

    guard httpResponse.statusCode == 200 else {
      if let errorStr = String(data: data, encoding: .utf8) {
        throw GeminiError.apiError(httpResponse.statusCode, errorStr)
      }
      throw GeminiError.apiError(httpResponse.statusCode, "Unknown error")
    }

    let result = try JSONDecoder().decode(ResponseBody.self, from: data)
    guard let text = result.candidates?.first?.content?.parts?.first?.text else {
      throw GeminiError.invalidResponse
    }

    return text
  }

  func askAboutHighlight(highlightedText: String, question: String) async throws -> String {
    try await ask(question: question, context: highlightedText)
  }
}

enum GeminiError: LocalizedError {
  case noAPIKey
  case networkError
  case apiError(Int, String)
  case invalidResponse

  var errorDescription: String? {
    switch self {
    case .noAPIKey:
      return loc("No API key set. Add your Gemini API key in Settings.")
    case .networkError:
      return loc("Network error. Check your connection.")
    case .apiError(let code, let msg):
      return loc("API error (\(code)): \(msg)")
    case .invalidResponse:
      return loc("Invalid response from API.")
    }
  }
}
