import SwiftUI

struct LessonView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject
  let module: ModuleMeta
  var scrollTarget: Binding<String?>?

  @State private var showAI = false
  @State private var selectedText = ""
  @State private var internalScrollTarget: String? = nil

  private var effectiveScrollTarget: Binding<String?> {
    scrollTarget ?? Binding(get: { internalScrollTarget }, set: { internalScrollTarget = $0 })
  }

  var body: some View {
    HSplitView {
      lessonContent
        .frame(minWidth: DesignConstants.Size.contentMinWidth, maxWidth: .infinity)

      if showAI {
        AskAIView(selectedText: selectedText)
          .frame(width: DesignConstants.Size.sidebarWidth)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .toolbar {
      ToolbarItem {
        Button(action: { showAI.toggle() }) {
          Label("Ask AI", systemImage: "sparkles")
        }
        .help("Ask AI about highlighted content")
      }
      ToolbarItem {
        Button(action: { viewModel.startQuiz(subject: subject, module: module) }) {
          Label("Quiz", systemImage: "checkmark.circle")
        }
        .help("Take module quiz")
      }
    }
  }

  private var lessonContent: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
      moduleHeader
      renderedContent
    }
    .padding(DesignConstants.Padding.group)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(VisualEffectBackground())
  }

  private var moduleHeader: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      Text(subject.displayName)
        .font(.caption)
        .foregroundStyle(AppColors.secondaryLabel)

      Text(module.name)
        .font(DesignConstants.Font.title2)
        .fontWeight(.bold)
    }
  }

  private var renderedContent: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
      if viewModel.lessonContent.isEmpty {
        Text("Lesson content not available.")
          .foregroundStyle(AppColors.secondaryLabel)
      } else {
        LessonMarkdownView(
          markdown: viewModel.lessonContent,
          fontSize: viewModel.lessonFontSize,
          selectedText: $selectedText,
          scrollTarget: effectiveScrollTarget
        )
      }
    }
  }
}

struct LessonMarkdownView: NSViewRepresentable {
  let markdown: String
  let fontSize: Double
  @Binding var selectedText: String
  var scrollTarget: Binding<String?>?

  private var scaled: (base: CGFloat, heading: CGFloat, subheading: CGFloat, code: CGFloat) {
    (
      CGFloat(fontSize), CGFloat(fontSize + DesignConstants.FontSize.headingOffset),
      CGFloat(fontSize + DesignConstants.FontSize.subheadingOffset),
      CGFloat(fontSize + DesignConstants.FontSize.codeOffset)
    )
  }

  func makeNSView(context: Context) -> NSScrollView {
    let scrollView = NSScrollView()
    scrollView.hasVerticalScroller = true
    scrollView.hasHorizontalScroller = false
    scrollView.drawsBackground = false
    scrollView.borderType = .noBorder

    let textView = NSTextView()
    textView.isEditable = false
    textView.isSelectable = true
    textView.drawsBackground = false
    textView.textContainerInset = NSSize(width: 0, height: 4)
    textView.delegate = context.coordinator

    textView.isHorizontallyResizable = false
    textView.isVerticallyResizable = true
    textView.autoresizingMask = [.width]
    textView.textContainer?.containerSize = NSSize(
      width: textView.frame.width, height: CGFloat.greatestFiniteMagnitude)
    textView.textContainer?.widthTracksTextView = true

    scrollView.documentView = textView
    return scrollView
  }

  func updateNSView(_ scrollView: NSScrollView, context: Context) {
    guard let textView = scrollView.documentView as? NSTextView else { return }

    if context.coordinator.lastMarkdown != markdown
      || context.coordinator.lastFontSize != fontSize
    {
      let attrs = parseMarkdown(markdown, fontSize: fontSize)
      textView.textStorage?.setAttributedString(attrs)
      context.coordinator.lastMarkdown = markdown
      context.coordinator.lastFontSize = fontSize
      context.coordinator.lastScrolledTarget = nil
    }

    if let target = scrollTarget?.wrappedValue {
      context.coordinator.scrollToHeading(target, in: textView)
    }
  }

  func makeCoordinator() -> Coordinator {
    let s = scaled
    return Coordinator(
      selectedText: $selectedText,
      headingFontSize: s.heading,
      subheadingFontSize: s.subheading
    )
  }

  @MainActor
  class Coordinator: NSObject, NSTextViewDelegate {
    @Binding var selectedText: String
    var lastMarkdown: String?
    var lastFontSize: Double?
    var lastScrolledTarget: String?
    let headingFontSize: CGFloat
    let subheadingFontSize: CGFloat

    init(selectedText: Binding<String>, headingFontSize: CGFloat, subheadingFontSize: CGFloat) {
      _selectedText = selectedText
      self.headingFontSize = headingFontSize
      self.subheadingFontSize = subheadingFontSize
    }

    func textViewDidChangeSelection(_ notification: Notification) {
      guard let textView = notification.object as? NSTextView else { return }
      let range = textView.selectedRange()
      if range.length > 0 {
        selectedText = (textView.string as NSString).substring(with: range)
      }
    }

    func scrollToHeading(_ heading: String, in textView: NSTextView) {
      guard heading != lastScrolledTarget else { return }
      lastScrolledTarget = heading

      guard let storage = textView.textStorage else { return }

      var foundRange: NSRange?
      storage.enumerateAttribute(
        .font, in: NSRange(location: 0, length: storage.length), options: []
      ) { value, range, stop in
        guard let font = value as? NSFont else { return }
        if font.pointSize == headingFontSize || font.pointSize == subheadingFontSize {
          let text = storage.attributedSubstring(from: range).string
          if text == heading {
            foundRange = range
            stop.pointee = ObjCBool(true)
          }
        }
      }

      if let foundRange {
        textView.scrollRangeToVisible(foundRange)
        textView.setSelectedRange(foundRange)
      }
    }
  }

  private func parseMarkdown(_ md: String, fontSize: Double) -> NSAttributedString {
    let result = NSMutableAttributedString()

    let baseFont = NSFont.systemFont(ofSize: fontSize)
    let boldFont = NSFont.boldSystemFont(ofSize: fontSize)
    let headingFont = NSFont.boldSystemFont(ofSize: fontSize + 6)
    let subheadingFont = NSFont.boldSystemFont(ofSize: fontSize + 2)
    let codeFont = NSFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular)

    let lines = md.components(separatedBy: .newlines)
    var inCodeBlock = false
    var codeBlockLines: [String] = []
    var inTable = false
    var tableLines: [[String]] = []

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)

      if trimmed.hasPrefix("```") {
        if inCodeBlock {
          let code = codeBlockLines.joined(separator: "\n")
          let attrs: [NSAttributedString.Key: Any] = [
            .font: codeFont,
            .foregroundColor: NSColor.secondaryLabelColor,
            .backgroundColor: NSColor.controlBackgroundColor.withAlphaComponent(
              DesignConstants.Opacity.codeBlockBackground),
          ]
          let codeStr = NSAttributedString(string: code + "\n", attributes: attrs)
          result.append(codeStr)
          codeBlockLines = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        continue
      }

      if inCodeBlock {
        codeBlockLines.append(line)
        continue
      }

      if trimmed.hasPrefix("|") {
        if !inTable {
          inTable = true
          tableLines = []
        }
        let cells = trimmed.components(separatedBy: "|")
          .map { $0.trimmingCharacters(in: .whitespaces) }
          .filter { !$0.isEmpty }
        tableLines.append(cells)
        continue
      } else if inTable {
        appendTable(result, tableLines, baseFont, fontSize: fontSize)
        tableLines = []
        inTable = false
      }

      if trimmed.hasPrefix("---") { continue }

      if trimmed.hasPrefix("### ") {
        let text = String(trimmed.dropFirst(4))
        let attrs: [NSAttributedString.Key: Any] = [
          .font: subheadingFont,
          .foregroundColor: NSColor.labelColor,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("## ") {
        let text = String(trimmed.dropFirst(3))
        let attrs: [NSAttributedString.Key: Any] = [
          .font: headingFont,
          .foregroundColor: NSColor.labelColor,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
        let text = String(trimmed.dropFirst(2))
        let attrs: [NSAttributedString.Key: Any] = [
          .font: baseFont,
          .foregroundColor: NSColor.labelColor,
        ]
        result.append(NSAttributedString(string: "  •  \(text)\n", attributes: attrs))
      } else if trimmed.hasPrefix("1. ") || trimmed.hasPrefix("2. ") || trimmed.hasPrefix("3. ") {
        let text = String(trimmed.dropFirst(3))
        let attrs: [NSAttributedString.Key: Any] = [
          .font: baseFont,
          .foregroundColor: NSColor.labelColor,
        ]
        result.append(
          NSAttributedString(string: "  \(trimmed.prefix(2)) \(text)\n", attributes: attrs))
      } else if trimmed.hasPrefix("|") {
        let parts = trimmed.components(separatedBy: "|")
          .map { $0.trimmingCharacters(in: .whitespaces) }
          .filter { !$0.isEmpty }
        let formatted = parts.joined(separator: "  |  ")
        let attrs: [NSAttributedString.Key: Any] = [
          .font: codeFont,
          .foregroundColor: NSColor.labelColor,
        ]
        result.append(NSAttributedString(string: "\(formatted)\n", attributes: attrs))
      } else if trimmed.isEmpty {
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("`") && trimmed.hasSuffix("`") {
        let text = String(trimmed.dropFirst().dropLast())
        let attrs: [NSAttributedString.Key: Any] = [
          .font: codeFont,
          .foregroundColor: NSColor.systemBlue,
        ]
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else {
        let attrs = parseInlineFormatting(trimmed, baseFont: baseFont, boldFont: boldFont)
        result.append(attrs)
        result.append(NSAttributedString(string: "\n"))
      }
    }

    if inCodeBlock {
      let code = codeBlockLines.joined(separator: "\n")
      let attrs: [NSAttributedString.Key: Any] = [
        .font: codeFont,
        .foregroundColor: NSColor.secondaryLabelColor,
      ]
      result.append(NSAttributedString(string: code, attributes: attrs))
    }

    if inTable {
      appendTable(result, tableLines, baseFont, fontSize: fontSize)
    }

    return result
  }

  private func parseInlineFormatting(
    _ line: String, baseFont: NSFont, boldFont: NSFont
  ) -> NSAttributedString {
    let result = NSMutableAttributedString()

    let remaining = line as NSString
    var pos = 0

    while pos < remaining.length {
      let boldRange = remaining.range(
        of: "**", options: [], range: NSRange(location: pos, length: remaining.length - pos))

      if boldRange.location != NSNotFound {
        if boldRange.location > pos {
          let plain = remaining.substring(
            with: NSRange(location: pos, length: boldRange.location - pos))
          result.append(
            NSAttributedString(
              string: plain, attributes: [.font: baseFont, .foregroundColor: NSColor.labelColor]))
        }
        let closeRange = remaining.range(
          of: "**", options: [],
          range: NSRange(
            location: boldRange.upperBound, length: remaining.length - boldRange.upperBound))
        if closeRange.location != NSNotFound {
          let boldText = remaining.substring(
            with: NSRange(
              location: boldRange.upperBound, length: closeRange.location - boldRange.upperBound))
          result.append(
            NSAttributedString(
              string: boldText, attributes: [.font: boldFont, .foregroundColor: NSColor.labelColor])
          )
          pos = closeRange.upperBound
        } else {
          pos = boldRange.upperBound
        }
      } else {
        let remainingText = remaining.substring(from: pos)
        result.append(
          NSAttributedString(
            string: remainingText,
            attributes: [.font: baseFont, .foregroundColor: NSColor.labelColor]))
        break
      }
    }

    return result
  }

  private func appendTable(
    _ result: NSMutableAttributedString, _ lines: [[String]], _ baseFont: NSFont, fontSize: Double
  ) {
    guard !lines.isEmpty else { return }
    let separatorLine = lines.first { line in
      line.allSatisfy { $0.allSatisfy { $0 == "-" || $0 == ":" } }
    }

    let dataLines = separatorLine == nil ? lines : Array(lines.dropFirst())

    for row in dataLines {
      let formatted = row.joined(separator: "  │  ")
      let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular),
        .foregroundColor: NSColor.labelColor,
      ]
      result.append(NSAttributedString(string: "\(formatted)\n", attributes: attrs))
    }
    result.append(NSAttributedString(string: "\n"))
  }
}
