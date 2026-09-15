/// <reference lib="webworker" />
import * as ort from "onnxruntime-web/wasm"
import { VOICE_CACHE } from "./voices"

/**
 * La sintesi delle voci neurali, in un thread a parte: riceve i fonemi di una
 * frase e restituisce l'audio. Il modello si scarica una volta, si verifica
 * con SHA-256 e resta nella Cache Storage del browser.
 */

ort.env.wasm.wasmPaths = {
  mjs: new URL("/ort/ort-wasm-simd-threaded.mjs", location.origin).href,
  wasm: new URL("/ort/ort-wasm-simd-threaded.wasm", location.origin).href,
}
ort.env.wasm.proxy = false
ort.env.wasm.numThreads = self.crossOriginIsolated
  ? Math.min(4, navigator.hardwareConcurrency || 1)
  : 1

export type PiperRequest =
  | { type: "load"; id: number; model: string; sha256: string }
  | {
      type: "synth"
      id: number
      model: string
      ids: number[]
      scales: [number, number, number]
      speaker?: number
    }

export type PiperResponse =
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "loaded"; id: number }
  | { type: "audio"; id: number; pcm: Float32Array }
  | { type: "error"; id: number; message: string }

const sessions = new Map<string, Promise<ort.InferenceSession>>()

const post = (message: PiperResponse, transfer: Transferable[] = []) =>
  postMessage(message, transfer)

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function download(url: string, id: number) {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Download della voce non riuscito (${response.status})`)
  }
  const total = Number(response.headers.get("content-length")) || 0
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let last = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    const now = performance.now()
    if (now - last > 120) {
      last = now
      post({ type: "progress", id, loaded, total })
    }
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  post({ type: "progress", id, loaded, total: total || loaded })
  return bytes.buffer
}

async function modelBytes(url: string, hash: string, id: number) {
  const cache = await caches.open(VOICE_CACHE).catch(() => null)
  const hit = await cache?.match(url)
  if (hit) {
    const bytes = await hit.arrayBuffer()
    if ((await sha256(bytes)) === hash) return bytes
    await cache?.delete(url)
  }
  const bytes = await download(url, id)
  if ((await sha256(bytes)) !== hash) {
    throw new Error("Il file della voce non è integro: riprova il download.")
  }
  await cache
    ?.put(
      url,
      new Response(bytes, {
        headers: { "content-type": "application/octet-stream" },
      })
    )
    .catch(() => {
      // spazio esaurito: la voce funziona lo stesso, ma si riscaricherà
    })
  return bytes
}

function session(model: string, hash: string, id: number) {
  let hit = sessions.get(model)
  if (!hit) {
    hit = modelBytes(model, hash, id).then((bytes) =>
      ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      })
    )
    hit.catch(() => sessions.delete(model))
    sessions.set(model, hit)
  }
  return hit
}

const hashes = new Map<string, string>()

addEventListener("message", async (event: MessageEvent<PiperRequest>) => {
  const message = event.data
  try {
    if (message.type === "load") {
      hashes.set(message.model, message.sha256)
      await session(message.model, message.sha256, message.id)
      post({ type: "loaded", id: message.id })
      return
    }
    const hash = hashes.get(message.model)
    if (!hash) throw new Error("Voce non caricata")
    const model = await session(message.model, hash, message.id)
    const feeds: Record<string, ort.Tensor> = {
      input: new ort.Tensor(
        "int64",
        BigInt64Array.from(message.ids, (n) => BigInt(n)),
        [1, message.ids.length]
      ),
      input_lengths: new ort.Tensor(
        "int64",
        BigInt64Array.from([BigInt(message.ids.length)]),
        [1]
      ),
      scales: new ort.Tensor("float32", Float32Array.from(message.scales), [3]),
    }
    if (message.speaker !== undefined) {
      feeds.sid = new ort.Tensor(
        "int64",
        BigInt64Array.from([BigInt(message.speaker)]),
        [1]
      )
    }
    const output = await model.run(feeds)
    const tensor = output.output ?? Object.values(output)[0]
    const pcm = Float32Array.from(tensor?.data as Float32Array)
    post({ type: "audio", id: message.id, pcm }, [pcm.buffer])
  } catch (error) {
    post({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
