import type { TranslateRequest, TranslateResponse } from "./translate.worker"
import { MODEL_DOWNLOAD_MB, translateRoute } from "./models"

import { tr } from "@/lib/i18n/client"
export type LocalProgress =
  | { phase: "download"; fraction: number; model?: string }
  | { phase: "translate"; done: number; total: number }

/**
 * Il traduttore sul dispositivo visto dal resto dell'app: un worker solo,
 * creato alla prima traduzione e riusato (i modelli restano in memoria).
 */

let worker: Worker | null = null
let nextId = 1
const waiting = new Map<
  number,
  {
    resolve: (texts: string[]) => void
    reject: (error: Error) => void
    progress?: (progress: LocalProgress) => void
  }
>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL("./translate.worker.ts", import.meta.url), {
    type: "module",
    name: "cogniva-translate",
  })
  worker.addEventListener(
    "message",
    (event: MessageEvent<TranslateResponse>) => {
      const message = event.data
      const job = waiting.get(message.id)
      if (!job) return
      if (message.type === "progress") {
        job.progress?.({
          phase: "download",
          fraction: Math.max(0, Math.min(1, message.progress / 100)),
          model: message.model,
        })
      } else if (message.type === "item") {
        job.progress?.({
          phase: "translate",
          done: message.done,
          total: message.total,
        })
      } else if (message.type === "result") {
        waiting.delete(message.id)
        job.resolve(message.texts)
      } else {
        waiting.delete(message.id)
        job.reject(new Error(tr(message.message)))
      }
    }
  )
  worker.addEventListener("error", (event) => {
    for (const [id, job] of waiting) {
      job.reject(new Error(event.message || tr("Il traduttore si è fermato")))
      waiting.delete(id)
    }
    worker?.terminate()
    worker = null
  })
  return worker
}

export function canTranslateLocally(source: string, target: string) {
  return (
    translateRoute(source, target) !== null && typeof Worker !== "undefined"
  )
}

export function translateLocally(
  texts: string[],
  source: string,
  target: string,
  onProgress?: (progress: LocalProgress) => void
): Promise<string[]> {
  const steps = translateRoute(source, target)
  if (!steps) {
    return Promise.reject(
      new Error(
        tr("Questa coppia di lingue non ha un modello sul dispositivo.")
      )
    )
  }
  if (!steps.length) return Promise.resolve(texts)
  const id = nextId++
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject, progress: onProgress })
    getWorker().postMessage({ id, steps, texts } satisfies TranslateRequest)
  })
}

/** Ferma la traduzione in corso (e libera la memoria dei modelli) */
export function cancelLocalTranslation() {
  if (!worker) return
  worker.terminate()
  worker = null
  for (const [id, job] of waiting) {
    job.reject(new DOMException(tr("Traduzione annullata"), "AbortError"))
    waiting.delete(id)
  }
}

/** Megabyte ancora da scaricare per questa coppia (0 se è già tutto qui) */
export async function downloadNeeded(source: string, target: string) {
  const steps = translateRoute(source, target)
  if (!steps?.length) return 0
  let cached: string[] = []
  try {
    const cache = await caches.open("transformers-cache")
    cached = (await cache.keys()).map((r) => r.url)
  } catch {
    // senza Cache Storage si riscarica ogni volta
  }
  const missing = steps.filter(
    (step) =>
      cached.filter(
        (url) => url.includes(`/${step.model}/`) && url.endsWith(".onnx")
      ).length < 2
  )
  return missing.length * MODEL_DOWNLOAD_MB
}
