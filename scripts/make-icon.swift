import Cocoa

let W: CGFloat = 1024
let H: CGFloat = 1024

guard let ctx = CGContext(
  data: nil,
  width: Int(W), height: Int(H),
  bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(),
  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("CGContext") }

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -8), blur: 20, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.35))

let box = CGRect(x: 60, y: 180, width: W - 120, height: H - 240)
let corner: CGFloat = 80
ctx.beginPath()
ctx.addPath(CGPath(roundedRect: box, cornerWidth: corner, cornerHeight: corner, transform: nil))
ctx.closePath()

let topColor = CGColor(red: 0.18, green: 0.42, blue: 0.78, alpha: 1)
let botColor = CGColor(red: 0.10, green: 0.28, blue: 0.60, alpha: 1)
let grad = CGGradient(
  colorsSpace: CGColorSpaceCreateDeviceRGB(),
  colors: [topColor, botColor] as CFArray,
  locations: [0, 1]
)!
ctx.clip()
ctx.drawLinearGradient(grad, start: CGPoint(x: W / 2, y: box.maxY), end: CGPoint(x: W / 2, y: box.minY), options: [])
ctx.restoreGState()

let centerX = W / 2
let bookW: CGFloat = 320
let bookH: CGFloat = 240
let spineW: CGFloat = 16
let pageEdgeW: CGFloat = 6
let stackGap: CGFloat = 22

let bookColors: [(fill: (r: CGFloat, g: CGFloat, b: CGFloat), spine: (r: CGFloat, g: CGFloat, b: CGFloat))] = [
  (fill: (0.93, 0.94, 0.96), spine: (0.70, 0.73, 0.80)),
  (fill: (0.88, 0.90, 0.95), spine: (0.65, 0.68, 0.78)),
  (fill: (0.82, 0.85, 0.93), spine: (0.60, 0.64, 0.76)),
]

let rotations: [CGFloat] = [0, -8, 5]
let yOffsets: [CGFloat] = [0, stackGap, stackGap * 2]
let baseY = box.minY + (box.height - bookH) / 2 - stackGap

for i in 0..<3 {
  ctx.saveGState()

  let angle = rotations[i] * .pi / 180
  let bx = centerX - bookW / 2
  let by = baseY + yOffsets[i]

  ctx.translateBy(x: centerX, y: by + bookH / 2)
  ctx.rotate(by: angle)
  ctx.translateBy(x: -centerX, y: -(by + bookH / 2))

  ctx.setShadow(offset: CGSize(width: -3, height: -3), blur: 10, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.25))

  let bookRect = CGRect(x: bx, y: by, width: bookW, height: bookH)
  let bookPath = CGPath(roundedRect: bookRect, cornerWidth: 12, cornerHeight: 12, transform: nil)
  ctx.beginPath()
  ctx.addPath(bookPath)
  ctx.closePath()
  ctx.setFillColor(CGColor(red: bookColors[i].fill.r, green: bookColors[i].fill.g, blue: bookColors[i].fill.b, alpha: 1))
  ctx.fillPath()

  ctx.setShadow(offset: .zero, blur: 0)

  let spineRect = CGRect(x: bx, y: by, width: spineW, height: bookH)
  let spinePath = CGPath(roundedRect: spineRect, cornerWidth: 12, cornerHeight: 12, transform: nil)
  ctx.beginPath()
  ctx.addPath(spinePath)
  ctx.closePath()
  ctx.setFillColor(CGColor(red: bookColors[i].spine.r, green: bookColors[i].spine.g, blue: bookColors[i].spine.b, alpha: 1))
  ctx.fillPath()

  let pageRect = CGRect(x: bx + bookW - pageEdgeW, y: by + 10, width: pageEdgeW, height: bookH - 20)
  ctx.beginPath()
  ctx.addPath(CGPath(roundedRect: pageRect, cornerWidth: 2, cornerHeight: 2, transform: nil))
  ctx.closePath()
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.7))
  ctx.fillPath()

  let lineColor = CGColor(red: 0.75, green: 0.78, blue: 0.84, alpha: 0.5)
  ctx.setStrokeColor(lineColor)
  ctx.setLineWidth(3)
  let lineStartX = bx + spineW + 20
  let lineEndX = bx + bookW - pageEdgeW - 16
  let lineSpacing: CGFloat = 28
  let firstLineY = by + bookH - 40
  for j in 0..<5 {
    let ly = firstLineY - CGFloat(j) * lineSpacing
    if ly < by + 30 { break }
    let lw = (j % 3 == 2) ? (lineEndX - lineStartX) * 0.6 : (lineEndX - lineStartX)
    ctx.move(to: CGPoint(x: lineStartX, y: ly))
    ctx.addLine(to: CGPoint(x: lineStartX + lw, y: ly))
    ctx.strokePath()
  }

  ctx.restoreGState()
}

guard let image = ctx.makeImage() else { fatalError("makeImage") }
let rep = NSBitmapImageRep(cgImage: image)
guard let data = rep.representation(using: .png, properties: [:]) else { fatalError("PNG") }
try data.write(to: URL(fileURLWithPath: CommandLine.arguments[1] + "/icon_1024.png"))
