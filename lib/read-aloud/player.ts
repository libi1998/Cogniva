import type { Editor } from "@tiptap/core"
import type { Transaction } from "@tiptap/pm/state"
import { setReadAloudHighlight } from "./highlight"
import { loadVoice, synthesize } from "./neural"
import { loadPhonemizer } from "./phonemizer"
import {
  sentencesOf,
  wordAt,
  wordsOf,
  wordTimeline,
  type Sentence,
  type Word,
} from "./text"
import type { NeuralVoice } from "./voices"

import { tr } from "@/lib/i18n/client"
/**
 * Il lettore ad alta voce: uno solo per pagina, fuori da React, così la
 * lettura continua anche cambiando scheda della barra multifunzione. Legge una
 * frase alla volta con una voce del sistema o con una voce neurale Cogniva,
 * evidenzia frase e parola, si mette in pausa e riprende dal punto esatto.
 */

export type ReaderVoice =
  | { kind: "system"; voice: SpeechSynthesisVoice | null }
  | { kind: "neural"; voice: NeuralVoice }

export type ReaderSnapshot = {
  state: "idle" | "loading" | "playing" | "paused"
  /** 0–1 durante il download di una voce neurale */
  download: number | null
  sentence: number
  total: number
  rate: number
  voiceName: string
  error: string | null
}

const IDLE: ReaderSnapshot = {
  state: "idle",
  download: null,
  sentence: 0,
  total: 0,
  rate: 1,
  voiceName: "",
  error: null,
}

let snapshot: ReaderSnapshot = IDLE
const listeners = new Set<() => void>()

function update(patch: Partial<ReaderSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  for (const listener of listeners) listener()
}

export const readerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => snapshot,
  getServer: () => IDLE,
}

type Hooks = {
  onWord: (charIndex: number) => void
  onEnd: () => void
  onError: (message: string) => void
}

interface Engine {
  speak(index: number, fromChar: number, hooks: Hooks): void
  /** true se la pausa è gestita dal motore (audio sospeso) */
  pause(): boolean
  resume(): boolean
  cancel(): void
}

/* ------------------------------ voci del sistema ------------------------- */

/** caratteri al secondo a velocità 1, imparati mentre la voce parla */
const learnedSpeed = new Map<string, number>()

class SystemEngine implements Engine {
  private token = 0
  private timer = 0
  constructor(
    private sentences: () => Sentence[],
    private voice: SpeechSynthesisVoice | null,
    private lang: string,
    private rate: () => number
  ) {}

  speak(index: number, fromChar: number, hooks: Hooks) {
    this.cancel()
    const token = ++this.token
    const sentence = this.sentences()[index]
    if (!sentence) return hooks.onEnd()
    const text = sentence.text.slice(fromChar)
    const words = wordsOf(text, this.lang)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = this.voice?.lang ?? this.lang
    if (this.voice) utterance.voice = this.voice
    utterance.rate = this.rate()
    const key = this.voice?.voiceURI ?? "default"
    let boundaries = false
    let started = 0

    utterance.onstart = () => {
      if (token !== this.token) return
      started = performance.now()
      hooks.onWord(fromChar + (words[0]?.start ?? 0))
      // alcune voci (Google, online) non dicono a che parola sono: si stima
      const timeline = wordTimeline(text, words)
      window.clearInterval(this.timer)
      this.timer = window.setInterval(() => {
        if (token !== this.token || boundaries) {
          window.clearInterval(this.timer)
          return
        }
        if (performance.now() - started < 350) return
        const speed = (learnedSpeed.get(key) ?? 14) * this.rate()
        const fraction = Math.min(
          0.999,
          (performance.now() - started) / 1000 / (text.length / speed)
        )
        let i = 0
        while (i + 1 < timeline.length && timeline[i + 1]! <= fraction) i += 1
        const word = words[i]
        if (word) hooks.onWord(fromChar + word.start)
      }, 90)
    }
    utterance.onboundary = (e) => {
      if (token !== this.token || e.name !== "word") return
      boundaries = true
      hooks.onWord(fromChar + e.charIndex)
    }
    utterance.onend = () => {
      if (token !== this.token) return
      window.clearInterval(this.timer)
      const seconds = (performance.now() - started) / 1000
      if (started && seconds > 0.8 && text.length > 25) {
        const measured = text.length / seconds / this.rate()
        const previous = learnedSpeed.get(key)
        learnedSpeed.set(
          key,
          previous ? previous * 0.6 + measured * 0.4 : measured
        )
      }
      hooks.onEnd()
    }
    utterance.onerror = (e) => {
      if (token !== this.token) return
      if (e.error === "interrupted" || e.error === "canceled") return
      window.clearInterval(this.timer)
      hooks.onError(
        e.error === "not-allowed"
          ? tr(
              "Il browser ha bloccato la voce: premi di nuovo «Leggi ad alta voce»."
            )
          : tr("La voce del sistema si è interrotta.")
      )
    }
    // Safari perde la frase se parte nello stesso istante dell'annullamento
    window.setTimeout(() => {
      if (token === this.token) window.speechSynthesis.speak(utterance)
    }, 30)
  }

  // la pausa nativa non è affidabile con le voci online: si annulla e si
  // riparte dalla parola a cui si era arrivati
  pause() {
    return false
  }
  resume() {
    return false
  }
  cancel() {
    this.token += 1
    window.clearInterval(this.timer)
    window.speechSynthesis.cancel()
  }
}

/* ------------------------------- voci neurali ---------------------------- */

class NeuralEngine implements Engine {
  private token = 0
  private context: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private frame = 0
  private cache = new Map<string, Promise<AudioBuffer>>()

  constructor(
    private sentences: () => Sentence[],
    private voice: NeuralVoice,
    private lang: string,
    private rate: () => number
  ) {}

  audio() {
    if (!this.context) this.context = new AudioContext()
    return this.context
  }

  private buffer(index: number, fromChar: number) {
    const sentence = this.sentences()[index]
    const rate = this.rate()
    const key = `${index}:${fromChar}:${rate}`
    let hit = this.cache.get(key)
    if (!hit && sentence) {
      const context = this.audio()
      hit = synthesize(this.voice, sentence.text.slice(fromChar), rate).then(
        ({ pcm, sampleRate }) => {
          const buffer = context.createBuffer(
            1,
            Math.max(1, pcm.length),
            sampleRate
          )
          buffer.copyToChannel(
            (pcm.length
              ? pcm
              : new Float32Array(1)) as Float32Array<ArrayBuffer>,
            0
          )
          return buffer
        }
      )
      hit.catch(() => this.cache.delete(key))
      this.cache.set(key, hit)
      // poche frasi in memoria: quelle vecchie si buttano
      if (this.cache.size > 6) {
        const oldest = this.cache.keys().next().value
        if (oldest) this.cache.delete(oldest)
      }
    }
    return hit
  }

  speak(index: number, fromChar: number, hooks: Hooks) {
    this.stopSource()
    const token = ++this.token
    const sentence = this.sentences()[index]
    const pending = this.buffer(index, fromChar)
    if (!sentence || !pending) return hooks.onEnd()
    // la frase dopo si prepara mentre questa suona
    void this.buffer(index + 1, 0)?.catch(() => undefined)
    const text = sentence.text.slice(fromChar)
    const words = wordsOf(text, this.lang)
    const timeline = wordTimeline(text, words)
    pending
      .then((buffer) => {
        if (token !== this.token) return
        const context = this.audio()
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        this.source = source
        const start = context.currentTime + 0.02
        // le voci Piper hanno silenzio ai bordi: la stima parte un po' dopo
        const lead = 0.12
        const span = Math.max(0.2, buffer.duration - lead - 0.2)
        const tick = () => {
          if (token !== this.token) return
          const fraction = (context.currentTime - start - lead) / span
          let i = 0
          while (i + 1 < timeline.length && timeline[i + 1]! <= fraction) i += 1
          const word = words[i]
          if (word) hooks.onWord(fromChar + word.start)
          this.frame = requestAnimationFrame(tick)
        }
        source.onended = () => {
          if (token !== this.token) return
          cancelAnimationFrame(this.frame)
          this.source = null
          hooks.onEnd()
        }
        source.start(start)
        this.frame = requestAnimationFrame(tick)
      })
      .catch((error: unknown) => {
        if (token !== this.token) return
        hooks.onError(
          error instanceof Error
            ? error.message
            : tr("La voce non ha risposto.")
        )
      })
  }

  pause() {
    void this.context?.suspend()
    return true
  }
  resume() {
    void this.context?.resume()
    return true
  }

  private stopSource() {
    cancelAnimationFrame(this.frame)
    if (this.source) {
      this.source.onended = null
      try {
        this.source.stop()
      } catch {
        // già finita
      }
      this.source.disconnect()
      this.source = null
    }
  }

  cancel() {
    this.token += 1
    this.stopSource()
    void this.context?.resume()
  }

  /** la velocità cambia l'audio da generare: quello pronto non vale più */
  invalidate() {
    this.cache.clear()
  }

  close() {
    this.cancel()
    void this.context?.close()
    this.context = null
  }
}

/* --------------------------------- lettore ------------------------------- */

class Reader {
  private editor: Editor | null = null
  private sentences: Sentence[] = []
  private engine: Engine | null = null
  private index = 0
  private char = 0
  private words: Word[] = []
  private lang = "it-IT"
  private rate = 1
  private voice: ReaderVoice = { kind: "system", voice: null }
  private detach: (() => void) | null = null
  private session = 0

  /** Parte dal cursore (o legge solo la selezione) */
  async start(editor: Editor, voice: ReaderVoice, lang: string, rate: number) {
    this.stop()
    const session = ++this.session
    const { from, to } = editor.state.selection
    const sentences = sentencesOf(editor.state.doc, from, to, lang)
    if (!sentences.length) {
      update({
        ...IDLE,
        rate,
        error: tr("Niente da leggere da qui in avanti."),
      })
      return false
    }
    this.editor = editor
    this.sentences = sentences
    this.lang = lang
    this.rate = rate
    this.voice = voice
    this.follow(editor)
    update({
      ...IDLE,
      state: voice.kind === "neural" ? "loading" : "playing",
      total: sentences.length,
      rate,
      voiceName: voice.voice?.name ?? tr("Voce predefinita"),
    })
    const ready = await this.prepare(voice, session)
    if (!ready || session !== this.session) return false
    this.play(0, 0)
    return true
  }

  private async prepare(voice: ReaderVoice, session: number) {
    this.engine?.cancel()
    if (this.engine instanceof NeuralEngine) this.engine.close()
    if (voice.kind === "system") {
      this.engine = new SystemEngine(
        () => this.sentences,
        voice.voice,
        this.lang,
        () => this.rate
      )
      return true
    }
    const engine = new NeuralEngine(
      () => this.sentences,
      voice.voice,
      this.lang,
      () => this.rate
    )
    // l'audio si sblocca con il clic che ha avviato la lettura
    void engine.audio().resume()
    this.engine = engine
    try {
      update({ state: "loading", download: 0 })
      await Promise.all([
        loadPhonemizer(),
        loadVoice(voice.voice, (fraction) => {
          if (session === this.session) update({ download: fraction })
        }),
      ])
      if (session !== this.session) return false
      update({ download: null })
      return true
    } catch (error) {
      if (session !== this.session) return false
      this.fail(
        error instanceof Error ? error.message : tr("Voce non disponibile.")
      )
      return false
    }
  }

  /** Le posizioni seguono le modifiche fatte mentre si legge */
  private follow(editor: Editor) {
    this.detach?.()
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return
      for (let i = this.index; i < this.sentences.length; i += 1) {
        const s = this.sentences[i]!
        s.map = s.map.map((pos) => transaction.mapping.map(pos))
      }
    }
    editor.on("transaction", onTransaction)
    const onDestroy = () => this.stop()
    editor.on("destroy", onDestroy)
    this.detach = () => {
      editor.off("transaction", onTransaction)
      editor.off("destroy", onDestroy)
    }
  }

  private play(index: number, fromChar: number) {
    const engine = this.engine
    const sentence = this.sentences[index]
    if (!engine || !sentence) {
      this.stop()
      return
    }
    this.index = index
    this.char = fromChar
    this.words = wordsOf(sentence.text, this.lang)
    update({ state: "playing", sentence: index, error: null })
    this.highlight()
    engine.speak(index, fromChar, {
      onWord: (charIndex) => {
        if (this.index !== index) return
        this.char = charIndex
        this.highlight()
      },
      onEnd: () => {
        if (this.index !== index || snapshot.state !== "playing") return
        if (index + 1 < this.sentences.length) this.play(index + 1, 0)
        else this.stop()
      },
      onError: (message) => this.fail(message),
    })
  }

  private highlight() {
    const sentence = this.sentences[this.index]
    if (!sentence || !this.editor) return
    const first = sentence.map[0]
    const lastPos = sentence.map[sentence.map.length - 1]
    const word = this.words[wordAt(this.words, this.char)]
    const wordFrom = word ? sentence.map[word.start] : undefined
    const wordTo = word ? sentence.map[word.end - 1] : undefined
    setReadAloudHighlight(this.editor, {
      sentence:
        first !== undefined && lastPos !== undefined
          ? { from: first, to: lastPos + 1 }
          : null,
      word:
        wordFrom !== undefined && wordTo !== undefined
          ? { from: wordFrom, to: wordTo + 1 }
          : null,
    })
  }

  /** Dove riprendere: l'inizio della parola in corso */
  private resumePoint() {
    const word = this.words[wordAt(this.words, this.char)]
    return word && word.start <= this.char ? word.start : 0
  }

  pause() {
    if (snapshot.state !== "playing" || !this.engine) return
    if (!this.engine.pause()) this.engine.cancel()
    update({ state: "paused" })
  }

  resume() {
    if (snapshot.state !== "paused" || !this.engine) return
    if (this.engine.resume()) update({ state: "playing" })
    else this.play(this.index, this.resumePoint())
  }

  /** Paragrafo successivo */
  next() {
    const current = this.sentences[this.index]?.paragraph ?? 0
    const target = this.sentences.findIndex(
      (s, i) => i > this.index && s.paragraph > current
    )
    if (target < 0) return this.stop()
    this.jump(target)
  }

  /** Inizio del paragrafo, o quello prima se si è già all'inizio */
  previous() {
    const current = this.sentences[this.index]?.paragraph ?? 0
    const startOfCurrent = this.sentences.findIndex(
      (s) => s.paragraph === current
    )
    const atStart = this.index === startOfCurrent && this.char < 12
    const paragraph = atStart ? current - 1 : current
    const target = this.sentences.findIndex((s) => s.paragraph === paragraph)
    this.jump(Math.max(0, target < 0 ? startOfCurrent : target))
  }

  private jump(index: number) {
    if (!this.engine) return
    // cancel() riattiva anche l'audio sospeso da una pausa
    this.engine.cancel()
    this.play(index, 0)
  }

  setRate(rate: number) {
    this.rate = rate
    update({ rate })
    if (!this.engine) return
    if (this.engine instanceof NeuralEngine) this.engine.invalidate()
    if (snapshot.state === "playing") {
      this.engine.cancel()
      this.play(this.index, this.resumePoint())
    }
  }

  async setVoice(voice: ReaderVoice) {
    this.voice = voice
    if (snapshot.state === "idle" || !this.editor) return
    const session = ++this.session
    const wasPaused = snapshot.state === "paused"
    const at = this.resumePoint()
    update({ voiceName: voice.voice?.name ?? tr("Voce predefinita") })
    const ready = await this.prepare(voice, session)
    if (!ready || session !== this.session) return
    if (wasPaused) {
      this.char = at
      update({ state: "paused" })
    } else this.play(this.index, at)
  }

  private fail(message: string) {
    this.stop()
    update({ error: message })
  }

  stop() {
    this.session += 1
    this.engine?.cancel()
    if (this.engine instanceof NeuralEngine) this.engine.close()
    this.engine = null
    this.detach?.()
    this.detach = null
    setReadAloudHighlight(this.editor, null)
    this.editor = null
    this.sentences = []
    update({ ...IDLE, rate: this.rate })
  }
}

export const reader = new Reader()
