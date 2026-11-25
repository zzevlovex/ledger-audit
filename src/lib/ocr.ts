// In-browser OCR: free, images never leave the computer.
// shortcut: tesseract.js downloads its English model from a CDN on first use (then cached by the
// browser). Self-host the traineddata file if the app must work fully offline on first run.
import { createWorker, type Worker } from 'tesseract.js'

let worker: Promise<Worker> | null = null
let progress: (pct: number) => void = () => {}

export async function readReceipt(file: File, onProgress: (pct: number) => void): Promise<{ text: string; confidence: number }> {
  worker ??= createWorker('eng', 1, { logger: (m) => m.status === 'recognizing text' && progress(Math.round(m.progress * 100)) })
  const w = await worker
  progress = onProgress // files are read one at a time, so one shared callback is enough
  const { data } = await w.recognize(file)
  return { text: data.text, confidence: data.confidence }
}
