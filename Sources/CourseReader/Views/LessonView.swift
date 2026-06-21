import SwiftUI

class CodeBlockTextView: NSTextView {
  var codeBlockRanges: [NSRange] = []
  var codeBlockBackgroundColor: NSColor = NSColor.controlBackgroundColor

  override func draw(_ dirtyRect: NSRect) {
    guard textStorage != nil,
      let layoutManager = layoutManager,
      let textContainer = textContainer
    else {
      super.draw(dirtyRect)
      return
    }

    let inset = textContainerInset
    let containerOrigin = NSPoint(x: inset.width, y: inset.height)

    for range in codeBlockRanges {
      let glyphRange = layoutManager.glyphRange(
        forCharacterRange: range, actualCharacterRange: nil)
      let boundingRect = layoutManager.boundingRect(
        forGlyphRange: glyphRange, in: textContainer)

      let bgRect = NSRect(
        x: 0,
        y: containerOrigin.y + boundingRect.origin.y - DesignConstants.Spacing.fileList,
        width: bounds.width,
        height: boundingRect.height + DesignConstants.Spacing.fileList * 2
      )

      codeBlockBackgroundColor.setFill()
      let path = NSBezierPath(roundedRect: bgRect, xRadius: 4, yRadius: 4)
      path.fill()
    }

    super.draw(dirtyRect)
  }
}

struct LessonView: View {
  @Environment(CourseViewModel.self)
  private var viewModel
  let subject: Subject
  let module: ModuleMeta
  var scrollTarget: Binding<String?>?
  var visibleSectionId: Binding<String?>?

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
        Button(action: { viewModel.decreaseFontSize() }) {
          Label(loc("Smaller"), systemImage: "textformat.size.smaller")
        }
        .help(loc("Decrease font size"))
      }
      ToolbarItem {
        Text("\(Int(viewModel.lessonFontSize)) pt")
          .font(DesignConstants.Font.caption)
      }
      ToolbarItem {
        Button(action: { viewModel.increaseFontSize() }) {
          Label(loc("Larger"), systemImage: "textformat.size.larger")
        }
        .help(loc("Increase font size"))
      }
      ToolbarItem {
        Button(action: { copyCodeToClipboard() }) {
          Label(loc("Copy Code"), systemImage: "doc.on.doc")
        }
        .help(loc("Copy code to clipboard"))
      }
      ToolbarItem {
        Button(action: { showAI.toggle() }) {
          Label(loc("Ask AI"), systemImage: "sparkles")
        }
        .help(loc("Ask AI about highlighted content"))
      }
      ToolbarItem {
        Button(action: { viewModel.startQuiz(subject: subject, module: module) }) {
          Label(loc("Quiz"), systemImage: "checkmark.circle")
        }
        .help(loc("Take module quiz"))
      }
    }
  }

  private var lessonContent: some View {
    ZStack(alignment: .bottom) {
      VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
        moduleHeader
        renderedContent
      }
      .padding(DesignConstants.Padding.group)
      .padding(.bottom, DesignConstants.Padding.dropZone)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(VisualEffectBackground())

      bottomNavBar
    }
    .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow], phases: .down) { press in
      switch press.key {
      case .leftArrow where press.modifiers.contains(.command) && viewModel.hasPrevModule:
        viewModel.navigateToModule(.prev)
        return .handled
      case .rightArrow where press.modifiers.contains(.command) && viewModel.hasNextModule:
        viewModel.navigateToModule(.next)
        return .handled
      case .upArrow where press.modifiers.contains(.command) && viewModel.hasPrevSection:
        viewModel.navigateToSection(.prev)
        return .handled
      case .downArrow where press.modifiers.contains(.command) && viewModel.hasNextSection:
        viewModel.navigateToSection(.next)
        return .handled
      default:
        return .ignored
      }
    }
    .simultaneousGesture(
      DragGesture(minimumDistance: 30, coordinateSpace: .local)
        .onEnded { value in
          let dx = value.translation.width
          let dy = value.translation.height
          if abs(dx) > abs(dy) {
            if dx < -50 {
              viewModel.navigateToModule(.next)
            } else if dx > 50 {
              viewModel.navigateToModule(.prev)
            }
          } else if abs(dy) > 50 {
            if dy < 0 {
              viewModel.navigateToSection(.next)
            } else {
              viewModel.navigateToSection(.prev)
            }
          }
        }
    )
  }

  private var moduleHeader: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.sectionHeader) {
      Text(subject.displayName)
        .font(.caption)
        .foregroundStyle(AppColors.secondaryLabel)

      HStack(spacing: DesignConstants.Spacing.sectionHeader) {
        VStack(alignment: .leading, spacing: DesignConstants.Spacing.labelPair) {
          Text(loc("Module \(module.id) of \(subject.modules.count)"))
            .font(.caption)
            .foregroundStyle(AppColors.secondaryLabel)
          Text(module.name)
            .font(DesignConstants.Font.title2)
            .fontWeight(.bold)
        }
      }
    }
  }

  private var bottomNavBar: some View {
    let currentSection = viewModel.readerSections.first(where: { $0.id == viewModel.readerVisibleSectionId })
    return HStack(spacing: DesignConstants.Spacing.groupBox) {
      Button(action: { viewModel.navigateToModule(.prev) }) {
        HStack(spacing: DesignConstants.Spacing.fileList) {
          Image(systemName: "chevron.left")
          Text(loc("Prev"))
            .font(.caption)
        }
      }
      .disabled(!viewModel.hasPrevModule)
      .help(loc("Previous module"))
      .inlineButton()
      .foregroundStyle(viewModel.hasPrevModule ? Color.accentColor : AppColors.secondaryLabel)

      Spacer()

      if !viewModel.readerSections.isEmpty {
        Button(action: { viewModel.navigateToSection(.prev) }) {
          Image(systemName: "chevron.up")
        }
        .disabled(!viewModel.hasPrevSection)
        .help(loc("Previous section"))
        .buttonStyle(.plain)
        .foregroundStyle(viewModel.hasPrevSection ? Color.accentColor : AppColors.secondaryLabel)

        Text(currentSection?.heading ?? loc("No section"))
          .font(.caption)
          .foregroundStyle(AppColors.secondaryLabel)
          .lineLimit(1)
          .frame(maxWidth: DesignConstants.Size.sidebarWidth * 0.3)

        Button(action: { viewModel.navigateToSection(.next) }) {
          Image(systemName: "chevron.down")
        }
        .disabled(!viewModel.hasNextSection)
        .help(loc("Next section"))
        .buttonStyle(.plain)
        .foregroundStyle(viewModel.hasNextSection ? Color.accentColor : AppColors.secondaryLabel)

        Spacer()
      } else {
        Spacer()
      }

      Button(action: { viewModel.navigateToModule(.next) }) {
        HStack(spacing: DesignConstants.Spacing.fileList) {
          Text(loc("Next"))
            .font(.caption)
          Image(systemName: "chevron.right")
        }
      }
      .disabled(!viewModel.hasNextModule)
      .help(loc("Next module"))
      .inlineButton()
      .foregroundStyle(viewModel.hasNextModule ? Color.accentColor : AppColors.secondaryLabel)
    }
    .padding(.horizontal, DesignConstants.Padding.group)
    .padding(.vertical, DesignConstants.Padding.card)
    .background(.regularMaterial)
    .clipShape(RoundedRectangle(cornerRadius: DesignConstants.CornerRadius.medium))
    .padding(.horizontal, DesignConstants.Padding.group)
    .padding(.bottom, DesignConstants.Padding.extraCompact)
  }

  private var renderedContent: some View {
    VStack(alignment: .leading, spacing: DesignConstants.Spacing.progressContent) {
      if viewModel.lessonContent.isEmpty {
        Text(loc("Lesson content not available."))
          .foregroundStyle(AppColors.secondaryLabel)
      } else {
        LessonMarkdownView(
          markdown: viewModel.lessonContent,
          fontSize: viewModel.lessonFontSize,
          selectedText: $selectedText,
          scrollTarget: effectiveScrollTarget,
          visibleSectionId: visibleSectionId,
          highlights: viewModel.currentHighlights,
          onAddHighlight: { text, start, end, color in
            viewModel.addHighlight(selectedText: text, startOffset: start, endOffset: end, color: color)
          },
          onDeleteHighlight: { highlight in
            viewModel.deleteHighlight(highlight)
          }
        )
      }
    }
  }

  private func copyCodeToClipboard() {
    let pb = NSPasteboard.general
    pb.clearContents()
    pb.setString(viewModel.lessonContent, forType: .string)
  }
}

private func highlightColor(from name: String) -> NSColor {
  switch name.lowercased() {
  case "yellow": return NSColor.systemYellow.withAlphaComponent(0.3)
  case "green": return NSColor.systemGreen.withAlphaComponent(0.3)
  case "blue": return NSColor.systemBlue.withAlphaComponent(0.3)
  case "pink": return NSColor.systemPink.withAlphaComponent(0.3)
  case "orange": return NSColor.systemOrange.withAlphaComponent(0.3)
  case "purple": return NSColor.systemPurple.withAlphaComponent(0.3)
  default: return NSColor.systemYellow.withAlphaComponent(0.3)
  }
}

struct LessonMarkdownView: NSViewRepresentable {
  let markdown: String
  let fontSize: Double
  @Binding var selectedText: String
  var scrollTarget: Binding<String?>?
  var visibleSectionId: Binding<String?>?
  var highlights: [Highlight] = []
  var onAddHighlight: ((String, Int, Int, String) -> Void)?
  var onDeleteHighlight: ((Highlight) -> Void)?

  private var scaled:
    (
      base: CGFloat, h1: CGFloat, heading: CGFloat, subheading: CGFloat, h4: CGFloat, h5: CGFloat,
      h6: CGFloat, code: CGFloat
    )
  {
    (
      CGFloat(fontSize),
      CGFloat(fontSize + DesignConstants.FontSize.h1Offset),
      CGFloat(fontSize + DesignConstants.FontSize.headingOffset),
      CGFloat(fontSize + DesignConstants.FontSize.subheadingOffset),
      CGFloat(fontSize + DesignConstants.FontSize.h4Offset),
      CGFloat(fontSize + DesignConstants.FontSize.h5Offset),
      CGFloat(fontSize + DesignConstants.FontSize.h6Offset),
      CGFloat(fontSize + DesignConstants.FontSize.codeOffset)
    )
  }

  func makeNSView(context: Context) -> NSScrollView {
    let scrollView = NSScrollView()
    scrollView.hasVerticalScroller = true
    scrollView.hasHorizontalScroller = false
    scrollView.drawsBackground = false
    scrollView.borderType = .noBorder

    let textView = CodeBlockTextView()
    textView.isEditable = false
    textView.isSelectable = true
    textView.drawsBackground = false
    textView.textContainerInset = NSSize(width: 0, height: 4)
    textView.delegate = context.coordinator
    textView.codeBlockBackgroundColor = HighlighterService.shared.themeBackgroundColor

    textView.isHorizontallyResizable = false
    textView.isVerticallyResizable = true
    textView.autoresizingMask = [.width]
    textView.textContainer?.containerSize = NSSize(
      width: textView.frame.width, height: CGFloat.greatestFiniteMagnitude)
    textView.textContainer?.widthTracksTextView = true

    scrollView.documentView = textView

    let observer = NotificationCenter.default.addObserver(
      forName: NSView.boundsDidChangeNotification,
      object: scrollView.contentView,
      queue: .main
    ) { [coordinator = context.coordinator] _ in
      MainActor.assumeIsolated {
        coordinator.handleScroll(scrollView)
      }
    }
    context.coordinator.scrollObserver = observer

    return scrollView
  }

  func updateNSView(_ scrollView: NSScrollView, context: Context) {
    guard let textView = scrollView.documentView as? CodeBlockTextView else { return }

    textView.codeBlockBackgroundColor = HighlighterService.shared.themeBackgroundColor
    context.coordinator.highlights = highlights
    context.coordinator.onAddHighlight = onAddHighlight
    context.coordinator.onDeleteHighlight = onDeleteHighlight

    if context.coordinator.lastMarkdown != markdown
      || context.coordinator.lastFontSize != fontSize
    {
      context.coordinator.lastMarkdown = markdown
      context.coordinator.lastFontSize = fontSize
      context.coordinator.lastScrolledTarget = nil

      let s = scaled
      Task { @MainActor in
        let (attrs, codeRanges) = await parseMarkdown(markdown, fontSize: fontSize)
        textView.textStorage?.setAttributedString(attrs)
        textView.codeBlockRanges = codeRanges
        textView.setNeedsDisplay(textView.bounds)
        context.coordinator.buildSectionPositions(
          in: textView,
          h1FontSize: s.h1,
          headingFontSize: s.heading,
          subheadingFontSize: s.subheading,
          h4FontSize: s.h4,
          h5FontSize: s.h5,
          h6FontSize: s.h6
        )
        context.coordinator.applyHighlights(to: textView)
        context.coordinator.handleScroll(scrollView)
      }
    } else {
      context.coordinator.applyHighlights(to: textView)
    }

    if let target = scrollTarget?.wrappedValue {
      context.coordinator.scrollToHeading(target, in: textView, scrollView: scrollView)
    }
  }

  func makeCoordinator() -> Coordinator {
    let s = scaled
    return Coordinator(
      selectedText: $selectedText,
      h1FontSize: s.h1,
      headingFontSize: s.heading,
      subheadingFontSize: s.subheading,
      h4FontSize: s.h4,
      h5FontSize: s.h5,
      h6FontSize: s.h6,
      visibleSectionId: visibleSectionId,
      highlights: highlights,
      onAddHighlight: onAddHighlight,
      onDeleteHighlight: onDeleteHighlight
    )
  }

  @MainActor
  class Coordinator: NSObject, NSTextViewDelegate {
    @Binding var selectedText: String
    var visibleSectionId: Binding<String?>?
    var lastMarkdown: String?
    var lastFontSize: Double?
    var lastScrolledTarget: String?
    var lastReportedSectionId: String = ""
    let h1FontSize: CGFloat
    let headingFontSize: CGFloat
    let subheadingFontSize: CGFloat
    let h4FontSize: CGFloat
    let h5FontSize: CGFloat
    let h6FontSize: CGFloat
    nonisolated(unsafe) var scrollObserver: NSObjectProtocol?
    var sectionPositions: [(id: String, y: CGFloat, level: Int)] = []
    var highlights: [Highlight] = []
    var lastSelectedRange: NSRange?
    var onAddHighlight: ((String, Int, Int, String) -> Void)?
    var onDeleteHighlight: ((Highlight) -> Void)?

    init(
      selectedText: Binding<String>, h1FontSize: CGFloat, headingFontSize: CGFloat,
      subheadingFontSize: CGFloat, h4FontSize: CGFloat, h5FontSize: CGFloat, h6FontSize: CGFloat,
      visibleSectionId: Binding<String?>?,
      highlights: [Highlight] = [],
      onAddHighlight: ((String, Int, Int, String) -> Void)? = nil,
      onDeleteHighlight: ((Highlight) -> Void)? = nil
    ) {
      _selectedText = selectedText
      self.h1FontSize = h1FontSize
      self.headingFontSize = headingFontSize
      self.subheadingFontSize = subheadingFontSize
      self.h4FontSize = h4FontSize
      self.h5FontSize = h5FontSize
      self.h6FontSize = h6FontSize
      self.visibleSectionId = visibleSectionId
      self.highlights = highlights
      self.onAddHighlight = onAddHighlight
      self.onDeleteHighlight = onDeleteHighlight
    }

    deinit {
      if let observer = scrollObserver {
        NotificationCenter.default.removeObserver(observer)
      }
    }

    func textViewDidChangeSelection(_ notification: Notification) {
      guard let textView = notification.object as? NSTextView else { return }
      let range = textView.selectedRange()
      if range.length > 0 {
        lastSelectedRange = range
        selectedText = (textView.string as NSString).substring(with: range)
        let alreadyHighlighted = highlights.contains { h in
          h.startOffset == range.location && h.endOffset == range.upperBound
        }
        if !alreadyHighlighted {
          onAddHighlight?(selectedText, range.location, range.upperBound, "yellow")
        }
      } else {
        lastSelectedRange = nil
      }
    }

    func textView(
      _ textView: NSTextView, menu: NSMenu, for event: NSEvent, at charIndex: Int
    ) -> NSMenu? {
      guard charIndex >= 0, charIndex < textView.string.count else { return menu }
      for h in highlights {
        let range = NSRange(location: h.startOffset, length: h.endOffset - h.startOffset)
        if range.contains(charIndex) {
          let item = NSMenuItem(
            title: loc("Remove Highlight"),
            action: #selector(removeHighlight(_:)),
            keyEquivalent: "")
          item.representedObject = h
          item.target = self
          menu.addItem(.separator())
          menu.addItem(item)
          break
        }
      }
      return menu
    }

    @objc private func removeHighlight(_ sender: NSMenuItem) {
      guard let highlight = sender.representedObject as? Highlight else { return }
      onDeleteHighlight?(highlight)
    }

    func scrollToHeading(_ heading: String, in textView: NSTextView, scrollView: NSScrollView) {
      guard heading != lastScrolledTarget else { return }
      lastScrolledTarget = heading

      guard let storage = textView.textStorage else { return }

      let headingSizes: Set<CGFloat> = [
        h1FontSize, headingFontSize, subheadingFontSize, h4FontSize, h5FontSize, h6FontSize,
      ]

      var foundRange: NSRange?
      storage.enumerateAttribute(
        .font, in: NSRange(location: 0, length: storage.length), options: []
      ) { value, range, stop in
        guard let font = value as? NSFont else { return }
        if headingSizes.contains(font.pointSize) {
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

        if let layoutManager = textView.layoutManager,
          let textContainer = textView.textContainer
        {
          let glyphRange = layoutManager.glyphRange(
            forCharacterRange: foundRange, actualCharacterRange: nil)
          let rect = layoutManager.boundingRect(
            forGlyphRange: glyphRange, in: textContainer)
          let topOffset = DesignConstants.Padding.section
          let newOrigin = max(0, rect.origin.y - topOffset)
          let targetPoint = NSPoint(x: 0, y: newOrigin)
          NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.35
            ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            ctx.allowsImplicitAnimation = true
            scrollView.contentView.animator().scroll(to: targetPoint)
            scrollView.reflectScrolledClipView(scrollView.contentView)
          }
        }
      }
    }

    func buildSectionPositions(
      in textView: NSTextView,
      h1FontSize: CGFloat? = nil,
      headingFontSize: CGFloat? = nil,
      subheadingFontSize: CGFloat? = nil,
      h4FontSize: CGFloat? = nil,
      h5FontSize: CGFloat? = nil,
      h6FontSize: CGFloat? = nil
    ) {
      sectionPositions.removeAll()
      guard let storage = textView.textStorage else { return }

      let sizeToLevel: [CGFloat: Int] = [
        h1FontSize ?? self.h1FontSize: 1,
        headingFontSize ?? self.headingFontSize: 2,
        subheadingFontSize ?? self.subheadingFontSize: 3,
        h4FontSize ?? self.h4FontSize: 4,
        h5FontSize ?? self.h5FontSize: 5,
        h6FontSize ?? self.h6FontSize: 6,
      ]

      storage.enumerateAttribute(
        .font, in: NSRange(location: 0, length: storage.length), options: []
      ) { value, range, stop in
        guard let font = value as? NSFont else { return }
        guard let level = sizeToLevel[font.pointSize] else { return }
        let text = storage.attributedSubstring(from: range).string
        let id = text.lowercased()
          .replacingOccurrences(of: " ", with: "-")
          .replacingOccurrences(of: ":", with: "")
          .replacingOccurrences(of: ",", with: "")
          .replacingOccurrences(of: "(", with: "")
          .replacingOccurrences(of: ")", with: "")
        if let layoutManager = textView.layoutManager, let textContainer = textView.textContainer
        {
          let glyphRange = layoutManager.glyphRange(
            forCharacterRange: range, actualCharacterRange: nil)
          let rect = layoutManager.boundingRect(forGlyphRange: glyphRange, in: textContainer)
          self.sectionPositions.append((id: id, y: rect.origin.y, level: level))
        }
      }
      sectionPositions.sort { $0.y < $1.y }
    }

    func applyHighlights(to textView: NSTextView) {
      guard let storage = textView.textStorage else { return }
      let fullRange = NSRange(location: 0, length: storage.length)
      storage.removeAttribute(.backgroundColor, range: fullRange)
      for h in highlights {
        let range = NSRange(location: h.startOffset, length: h.endOffset - h.startOffset)
        guard range.upperBound <= storage.length else { continue }
        let color = highlightColor(from: h.color)
        storage.addAttribute(.backgroundColor, value: color, range: range)
      }
    }

    func handleScroll(_ scrollView: NSScrollView) {
      guard !sectionPositions.isEmpty else { return }
      let visibleY = scrollView.contentView.bounds.origin.y
      let visibleBottom = visibleY + scrollView.contentView.bounds.height

      var bestSectionId: String?
      for pos in sectionPositions where pos.y <= visibleY {
        bestSectionId = pos.id
      }

      guard let sectionId = bestSectionId,
            let pos = sectionPositions.first(where: { $0.id == sectionId }),
            pos.y < visibleBottom
      else { return }

      if sectionId != lastReportedSectionId {
        lastReportedSectionId = sectionId
        visibleSectionId?.wrappedValue = sectionId
      }
    }
  }

  private func parseMarkdown(_ md: String, fontSize: Double) async -> (
    NSAttributedString, [NSRange]
  ) {
    let result = NSMutableAttributedString()
    var codeBlockRanges: [NSRange] = []

    let baseFont = NSFont.systemFont(ofSize: fontSize)
    let boldFont = NSFont.boldSystemFont(ofSize: fontSize)

    let lines = md.components(separatedBy: .newlines)
    var inCodeBlock = false
    var codeBlockLines: [String] = []
    var codeBlockLang = ""
    var inTable = false
    var tableLines: [[String]] = []

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespaces)

      if trimmed.hasPrefix("```") {
        if inCodeBlock {
          let code = codeBlockLines.joined(separator: "\n")
          let lang = codeBlockLang
          let codeFontSize = CGFloat(fontSize + DesignConstants.FontSize.codeOffset)
          let highlighted = HighlighterService.shared.highlight(
            code, language: lang, fontSize: codeFontSize)
          let codeAttr = NSMutableAttributedString(attributedString: highlighted)
          let bgRange = NSRange(location: 0, length: codeAttr.length)
          let paragraphStyle = NSMutableParagraphStyle()
          paragraphStyle.lineSpacing = DesignConstants.Spacing.fileList
          paragraphStyle.paragraphSpacingBefore = DesignConstants.Spacing.fileList
          paragraphStyle.paragraphSpacing = DesignConstants.Spacing.fileList
          codeAttr.addAttributes(
            [
              .paragraphStyle: paragraphStyle
            ], range: bgRange)
          if !code.hasSuffix("\n") {
            codeAttr.append(NSAttributedString(string: "\n"))
          }
          result.append(NSAttributedString(string: "\n"))
          let codeStart = result.length
          result.append(codeAttr)
          let codeEnd = result.length
          result.append(NSAttributedString(string: "\n"))
          codeBlockRanges.append(NSRange(location: codeStart, length: codeEnd - codeStart))
          codeBlockLines = []
          codeBlockLang = ""
          inCodeBlock = false
        } else {
          codeBlockLang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
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
        appendTable(result, tableLines, fontSize: fontSize)
        tableLines = []
        inTable = false
      }

      if trimmed.hasPrefix("---") { continue }

      if trimmed.hasPrefix("###### ") {
        let text = String(trimmed.dropFirst(7))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.h6Offset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h6,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("##### ") {
        let text = String(trimmed.dropFirst(6))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.h5Offset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h5,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("#### ") {
        let text = String(trimmed.dropFirst(5))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.h4Offset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h4,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("### ") {
        let text = String(trimmed.dropFirst(4))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.subheadingOffset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h3,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("## ") {
        let text = String(trimmed.dropFirst(3))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.headingOffset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h2,
        ]
        result.append(NSAttributedString(string: "\n"))
        result.append(NSAttributedString(string: text, attributes: attrs))
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("# ") {
        let text = String(trimmed.dropFirst(2))
        let f = NSFont.boldSystemFont(ofSize: fontSize + DesignConstants.FontSize.h1Offset)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: f, .foregroundColor: DesignConstants.HeaderColors.h1,
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
      } else if trimmed.isEmpty {
        result.append(NSAttributedString(string: "\n"))
      } else if trimmed.hasPrefix("`") && trimmed.hasSuffix("`") {
        let text = String(trimmed.dropFirst().dropLast())
        let inlineCodeFont = NSFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular)
        let attrs: [NSAttributedString.Key: Any] = [
          .font: inlineCodeFont,
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
      let codeFontSize = CGFloat(fontSize + DesignConstants.FontSize.codeOffset)
      let highlighted = HighlighterService.shared.highlight(
        code, language: codeBlockLang, fontSize: codeFontSize)
      let codeAttr = NSMutableAttributedString(attributedString: highlighted)
      let bgRange = NSRange(location: 0, length: codeAttr.length)
      let paragraphStyle = NSMutableParagraphStyle()
      paragraphStyle.lineSpacing = DesignConstants.Spacing.fileList
      paragraphStyle.paragraphSpacingBefore = DesignConstants.Spacing.fileList
      paragraphStyle.paragraphSpacing = DesignConstants.Spacing.fileList
      codeAttr.addAttributes(
        [
          .paragraphStyle: paragraphStyle
        ], range: bgRange)
      if !code.hasSuffix("\n") {
        codeAttr.append(NSAttributedString(string: "\n"))
      }
      result.append(NSAttributedString(string: "\n"))
      let codeStart = result.length
      result.append(codeAttr)
      let codeEnd = result.length
      codeBlockRanges.append(NSRange(location: codeStart, length: codeEnd - codeStart))
    }

    if inTable {
      appendTable(result, tableLines, fontSize: fontSize)
    }

    return (result, codeBlockRanges)
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
    _ result: NSMutableAttributedString, _ lines: [[String]], fontSize: Double
  ) {
    guard !lines.isEmpty else { return }

    var dataStart = 0
    for (i, line) in lines.enumerated() {
      if line.allSatisfy({ $0.allSatisfy { $0 == "-" || $0 == ":" } }) {
        dataStart = i + 1
        break
      }
    }

    let headerRow = dataStart > 0 ? lines[0] : nil
    let dataRows: [[String]] = dataStart < lines.count ? Array(lines[dataStart...]) : lines
    guard !dataRows.isEmpty else { return }

    let tableFont = NSFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .regular)
    let boldFont = NSFont.monospacedSystemFont(ofSize: fontSize - 1, weight: .bold)
    let totalCols = dataRows.map(\.count).max() ?? 0
    guard totalCols > 0 else { return }

    var colWidths = [Int](repeating: 0, count: totalCols)
    for row in [headerRow].compactMap({ $0 }) + dataRows {
      for (ci, cell) in row.enumerated() where ci < totalCols {
        colWidths[ci] = max(colWidths[ci], cell.count + 2)
      }
    }

    func padCell(_ cell: String, at col: Int) -> String {
      let w = col < colWidths.count ? colWidths[col] : cell.count + 2
      return cell.padding(toLength: w, withPad: " ", startingAt: 0)
    }

    if let header = headerRow {
      let filled = header + [String](repeating: "", count: max(0, totalCols - header.count))
      let formatted = filled.prefix(totalCols).enumerated().map { padCell($1, at: $0) }.joined(
        separator: "│")
      let attrs: [NSAttributedString.Key: Any] = [
        .font: boldFont,
        .foregroundColor: NSColor.labelColor,
        .backgroundColor: NSColor.controlAccentColor,
      ]
      result.append(NSAttributedString(string: formatted + "\n", attributes: attrs))
    }

    for (ri, row) in dataRows.enumerated() {
      let filled = row + [String](repeating: "", count: max(0, totalCols - row.count))
      let formatted = filled.prefix(totalCols).enumerated().map { padCell($1, at: $0) }.joined(
        separator: "│")
      let attrs: [NSAttributedString.Key: Any] = [
        .font: tableFont,
        .foregroundColor: NSColor.labelColor,
      ]
      let rowStr = NSMutableAttributedString(string: formatted + "\n", attributes: attrs)
      if ri % 2 == 1 {
        let bg = NSColor.controlBackgroundColor
        rowStr.addAttribute(
          .backgroundColor, value: bg, range: NSRange(location: 0, length: rowStr.length))
      }
      result.append(rowStr)
    }
    result.append(NSAttributedString(string: "\n"))
  }
}
