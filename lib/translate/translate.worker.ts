/// <reference lib="webworker" />
import {
  env,
  pipeline,
  type ProgressInfo,
  type TranslationPipeline,
} from "@huggingface/transformers"
import type { TranslateStep } from "./models"

/**
 * Traduzione sul dispositivo, in un thread a parte: l'editor resta fluido
 * mentre il modello lavora. I motori WebAssembly arrivano dal sito stesso
 * (public/ort), i modelli da Hugging Face una volta sola.
 */

env.allowLocalModels = false
env.useBrowserCache = true
// il motore si importa dal suo indirizzo, non da un blob: la CSP resta chiusa
env.useWasmCache = false
if (env.backends.onnx.wasm) {
  // stessi file che transformers.js prenderebbe da jsDelivr, ma serviti dal
  // sito: niente codice esterno e, dopo la prima volta, anche offline
  const safari =
    /Safari\//.test(navigator.userAgent) &&
    !/Chrom(e|ium)\/|Edg\//.test(navigator.userAgent)
  const build = safari
    ? "ort-wasm-simd-threaded"
    : "ort-wasm-simd-threaded.asyncify"
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(`/ort/${build}.mjs`, location.origin).href,
    wasm: new URL(`/ort/${build}.wasm`, location.origin).href,
  }
  env.backends.onnx.wasm.proxy = false
}

export type TranslateRequest = {
  id: number
  steps: TranslateStep[]
  texts: string[]
}

export type TranslateResponse =
  | {
      id: number
      type: "progress"
      progress: number
      loaded: number
      total: number
      model: string
    }
  | { id: number; type: "item"; done: number; total: number }
  | { id: number; type: "result"; texts: string[] }
  | { id: number; type: "error"; message: string }

const pipelines = new Map<string, Promise<TranslationPipeline>>()

function load(model: string, id: number) {
  let hit = pipelines.get(model)
  if (!hit) {
    hit = pipeline("translation", model, {
      dtype: "q8",
      device: "wasm",
      // l'ottimizzazione estesa di onnxruntime rompe i pesi condivisi
      // quantizzati dei modelli Marian: bastano quelle di base
      session_options: { graphOptimizationLevel: "basic" },
      progress_callback: (info: ProgressInfo) => {
        if (info.status !== "progress_total") return
        postMessage({
          id,
          type: "progress",
          progress: info.progress,
          loaded: info.loaded,
          total: info.total,
          model,
        } satisfies TranslateResponse)
      },
    }) as Promise<TranslationPipeline>
    // un download fallito si può riprovare
    hit.catch(() => pipelines.delete(model))
    pipelines.set(model, hit)
  }
  return hit
}

/** Frasi di lunghezza ragionevole: i modelli OPUS-MT reggono ~500 token */
function sentences(text: string) {
  const out: string[] = []
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "sentence" })
      : null
  const parts = segmenter
    ? [...segmenter.segment(text)].map((s) => s.segment)
    : (text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text])
  let current = ""
  for (const part of parts) {
    if ((current + part).length > 350 && current) {
      out.push(current)
      current = ""
    }
    current += part
  }
  if (current) out.push(current)
  return out
}

async function translateText(text: string, steps: TranslateStep[], id: number) {
  if (!text.trim()) return text
  // gli spazi ai bordi (e gli a capo) restano quelli dell'originale
  const lead = text.match(/^\s*/)?.[0] ?? ""
  const trail = text.match(/\s*$/)?.[0] ?? ""
  let pieces = sentences(text.trim())
  for (const step of steps) {
    const translator = await load(step.model, id)
    const next: string[] = []
    for (const piece of pieces) {
      const input = `${step.prefix ?? ""}${piece.trim()}`
      const output = (await translator(input, {
        max_new_tokens: 512,
      })) as { translation_text: string }[]
      next.push(output[0]?.translation_text ?? piece)
    }
    pieces = next
  }
  return `${lead}${pieces.join(" ")}${trail}`
}

addEventListener("message", async (event: MessageEvent<TranslateRequest>) => {
  const { id, steps, texts } = event.data
  try {
    const out: string[] = []
    for (const text of texts) {
      out.push(await translateText(text, steps, id))
      postMessage({
        id,
        type: "item",
        done: out.length,
        total: texts.length,
      } satisfies TranslateResponse)
    }
    postMessage({ id, type: "result", texts: out } satisfies TranslateResponse)
  } catch (error) {
    postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    } satisfies TranslateResponse)
  }
})
