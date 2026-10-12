#!/usr/bin/env swift
// Finds faces in the converted clips and photos of a film project, with macOS's Vision framework.
// usage: swift faces.swift <footage folder>
// Writes film-project/edit/src/faces.json: for every clip a sample each half second with the faces in it, and the faces in every photo.
// A face is [x, y, width, height] as fractions of the upright picture, measured from its top-left corner, largest first.
import AVFoundation
import Foundation
import ImageIO
import Vision

func fail(_ message: String) -> Never {
    FileHandle.standardError.write("FACES FAIL  \(message)\n".data(using: .utf8)!)
    exit(1)
}

guard CommandLine.arguments.count >= 2 else { fail("give the footage folder as the first argument") }
let footage = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let project = footage.appendingPathComponent("film-project")
let sourcesURL = project.appendingPathComponent("edit/src/sources.json")
guard let sourcesData = try? Data(contentsOf: sourcesURL),
      let sources = try? JSONSerialization.jsonObject(with: sourcesData) as? [String: Any]
else { fail("\(sourcesURL.path) is missing or unreadable; run convert.mjs first") }

/// A number as it should appear in the JSON: a decimal with a fixed number of places. A Double would be written with 17 digits.
func decimal(_ v: Double, places: Int) -> NSDecimalNumber { NSDecimalNumber(string: String(format: "%.\(places)f", v)) }
func round4(_ v: CGFloat) -> NSDecimalNumber { decimal(Double(v), places: 4) }

/// The faces in a picture, largest first.
func faces(in image: CGImage) -> [[NSDecimalNumber]] {
    let request = VNDetectFaceRectanglesRequest()
    do { try VNImageRequestHandler(cgImage: image, options: [:]).perform([request]) } catch { return [] }
    let boxes = (request.results ?? []).map { $0.boundingBox }.sorted { $0.width * $0.height > $1.width * $1.height }
    // Vision measures from the bottom-left corner; the edit measures from the top-left.
    return boxes.map { [round4($0.minX), round4(1 - $0.maxY), round4($0.width), round4($0.height)] }
}

var clipsOut: [String: [[String: Any]]] = [:]
var sampleCount = 0
var samplesWithFaces = 0
let clips = sources["clips"] as? [String: [[String: Any]]] ?? [:]
for (id, files) in clips.sorted(by: { $0.key < $1.key }) {
    var samples: [Double: [[NSDecimalNumber]]] = [:]
    // The normal-size file of a range is enough: a full-resolution file of the same range shows the same faces.
    for file in files where (file["tier"] as? String) != "F" {
        guard let name = file["file"] as? String,
              let a = (file["a"] as? NSNumber)?.doubleValue,
              let b = (file["b"] as? NSNumber)?.doubleValue
        else { continue }
        let asset = AVURLAsset(url: project.appendingPathComponent("sources/mezz/\(name)"))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = CMTime(value: 1, timescale: 30)
        generator.requestedTimeToleranceAfter = CMTime(value: 1, timescale: 30)
        var t = a
        while t < b - 0.05 {
            if let image = try? generator.copyCGImage(at: CMTime(seconds: t - a, preferredTimescale: 600), actualTime: nil) {
                samples[(t * 100).rounded() / 100] = faces(in: image)
            }
            t += 0.5
        }
    }
    let ordered: [[String: Any]] = samples.keys.sorted().map { ["t": decimal($0, places: 2), "f": samples[$0]!] }
    sampleCount += ordered.count
    samplesWithFaces += samples.values.filter { !$0.isEmpty }.count
    clipsOut[id] = ordered
}

var photosOut: [String: [[NSDecimalNumber]]] = [:]
let photos = sources["photos"] as? [String: [String: Any]] ?? [:]
for (id, info) in photos.sorted(by: { $0.key < $1.key }) {
    guard let name = info["file"] as? String else { continue }
    let url = project.appendingPathComponent("sources/photos/\(name)")
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else { continue }
    photosOut[id] = faces(in: image)
}

let target = project.appendingPathComponent("edit/src/faces.json")
do {
    let json = try JSONSerialization.data(withJSONObject: ["clips": clipsOut, "photos": photosOut], options: [.sortedKeys])
    try json.write(to: target)
} catch {
    fail("could not write \(target.path): \(error)")
}
let photosWithFaces = photosOut.values.filter { !$0.isEmpty }.count
print("FACES_OK  \(sampleCount) samples in \(clipsOut.count) clips, \(samplesWithFaces) with faces; \(photosWithFaces) of \(photosOut.count) photos with faces: \(target.path)")
