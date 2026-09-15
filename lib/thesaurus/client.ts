import type {
  LookupResult,
  ThesaurusRequest,
  ThesaurusResponse,
} from "./thesaurus.worker"
import { thesaurusFor } from "./catalog"

export type { LookupResult, Meaning } from "./thesaurus.worker"

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  {
    resolve: (value: LookupResult | boolean) => void
    reject: (error: Error) => void
    progress?: (fraction: number) => void
  }
>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL("./thesaurus.worker.ts", import.meta.url), {
    type: "module",
    name: "cogniva-thesaurus",
  })
  worker.addEventListener(
    "message",
    (event: MessageEvent<ThesaurusResponse>) => {
      const message = event.data
      const job = pending.get(message.id)
      if (!job) return
      if (message.type === "progress") return job.progress?.(message.fraction)
      pending.delete(message.id)
      if (message.type === "result") job.resolve(message.result)
      else if (message.type === "cached") job.resolve(message.cached)
      else job.reject(new Error(message.message))
    }
  )
  worker.addEventListener("error", (event) => {
    for (const [id, job] of pending) {
      job.reject(new Error(event.message || "Il thesaurus si è fermato"))
      pending.delete(id)
    }
    worker?.terminate()
    worker = null
  })
  return worker
}

type Outgoing = ThesaurusRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, "id">
    : never
  : never

function send<T extends LookupResult | boolean>(
  message: Outgoing,
  progress?: (fraction: number) => void
) {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: resolve as (value: LookupResult | boolean) => void,
      reject,
      progress,
    })
    getWorker().postMessage({ ...message, id } as ThesaurusRequest)
  })
}

export function lookupSynonyms(
  lang: string,
  word: string,
  onProgress?: (fraction: number) => void
) {
  const source = thesaurusFor(lang)
  if (!source) {
    return Promise.reject(
      new Error("Non c'è ancora un thesaurus per questa lingua.")
    )
  }
  return send<LookupResult>({ type: "lookup", source, word }, onProgress)
}

export function thesaurusDownloaded(lang: string) {
  const source = thesaurusFor(lang)
  if (!source) return Promise.resolve(false)
  return send<boolean>({ type: "cached", source })
}

/** «(generic term)», «(antonimo)»: note tra parentesi da non inserire nel testo */
export function cleanTerm(term: string) {
  return term.replace(/\s*\([^)]*\)\s*/g, " ").trim()
}

export function termNote(term: string) {
  return term.match(/\(([^)]*)\)/)?.[1] ?? ""
}

/** «Casa» → «Abitazione»: il sinonimo prende le maiuscole della parola */
export function matchCase(original: string, replacement: string) {
  if (!original) return replacement
  if (original.length > 1 && original === original.toLocaleUpperCase()) {
    return replacement.toLocaleUpperCase()
  }
  const first = original[0]!
  if (first !== first.toLocaleLowerCase()) {
    return replacement[0]!.toLocaleUpperCase() + replacement.slice(1)
  }
  return replacement
}
