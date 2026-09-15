"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  Check,
  ChevronDown,
  Download,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { loadVoice } from "@/lib/read-aloud/neural"
import { loadPhonemizer } from "@/lib/read-aloud/phonemizer"
import { reader, readerStore, type ReaderVoice } from "@/lib/read-aloud/player"
import {
  previewNeuralVoice,
  previewSystemVoice,
  stopPreview,
} from "@/lib/read-aloud/preview"
import {
  isNaturalVoice,
  loadSystemVoices,
  readRate,
  readVoiceChoice,
  saveRate,
  saveVoiceChoice,
  systemVoicesFor,
  type VoiceChoice,
} from "@/lib/read-aloud/system-voices"
import {
  deleteVoice,
  downloadedVoices,
  megabytes,
  neuralVoicesFor,
  type NeuralVoice,
} from "@/lib/read-aloud/voices"
import { cn } from "@/lib/utils"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRows,
} from "./ribbon/ribbon-ui"

/**
 * «Leggi ad alta voce» di Word: legge dal cursore (o la selezione) con una voce
 * del sistema o con una voce neurale che gira sul dispositivo, evidenziando la
 * parola letta. La lettura continua anche cambiando scheda.
 */

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const formatRate = (r: number) => `${String(r).replace(".", ",")}×`

const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window
const audioSupported = () =>
  typeof window !== "undefined" &&
  "AudioContext" in window &&
  "Worker" in window &&
  "caches" in window

export function useReader() {
  return React.useSyncExternalStore(
    readerStore.subscribe,
    readerStore.get,
    readerStore.getServer
  )
}

function useSystemVoices() {
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(() => {
    if (!speechSupported()) return
    let live = true
    void loadSystemVoices().then((list) => live && setVoices(list))
    const onChange = () => setVoices(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener("voiceschanged", onChange)
    return () => {
      live = false
      window.speechSynthesis.removeEventListener("voiceschanged", onChange)
    }
  }, [])
  return voices
}

function useDownloaded() {
  const [downloaded, setDownloaded] = React.useState<Set<string>>(new Set())
  const refresh = React.useCallback(() => {
    void downloadedVoices().then(setDownloaded)
  }, [])
  React.useEffect(() => {
    refresh()
  }, [refresh])
  return [downloaded, refresh] as const
}

/** La voce da usare: quella scelta, altrimenti la migliore disponibile */
function resolveVoice(
  lang: string,
  choice: VoiceChoice | null,
  system: SpeechSynthesisVoice[],
  neural: NeuralVoice[],
  downloaded: Set<string>
): ReaderVoice | null {
  if (choice?.kind === "neural") {
    const voice = neural.find((v) => v.id === choice.id)
    if (voice && audioSupported()) return { kind: "neural", voice }
  }
  if (choice?.kind === "system") {
    const voice = system.find((v) => v.voiceURI === choice.uri)
    if (voice) return { kind: "system", voice }
  }
  const best = system[0]
  if (best && isNaturalVoice(best)) return { kind: "system", voice: best }
  const ready = neural.find((v) => downloaded.has(v.id))
  if (ready && audioSupported()) return { kind: "neural", voice: ready }
  if (best) return { kind: "system", voice: best }
  if (speechSupported()) return { kind: "system", voice: null }
  const fallback = neural[0]
  return fallback && audioSupported()
    ? { kind: "neural", voice: fallback }
    : null
}

const sameVoice = (a: ReaderVoice | null, b: ReaderVoice | null) =>
  a?.kind === b?.kind &&
  (a?.kind === "neural"
    ? a.voice.id === (b as Extract<ReaderVoice, { kind: "neural" }>).voice.id
    : a?.voice?.voiceURI ===
      (b as Extract<ReaderVoice, { kind: "system" }> | null)?.voice?.voiceURI)

export function ReadAloudGroup({
  editor,
  language,
}: {
  editor: Editor
  language: string
}) {
  const lang = language || "it-IT"
  const snap = useReader()
  const system = systemVoicesFor(useSystemVoices(), lang)
  const neural = neuralVoicesFor(lang)
  const [downloaded, refreshDownloaded] = useDownloaded()
  const [choice, setChoice] = React.useState<VoiceChoice | null>(() =>
    readVoiceChoice(lang)
  )
  const rate = snap.rate
  const voice = resolveVoice(lang, choice, system, neural, downloaded)
  const supported = speechSupported() || audioSupported()

  // la lingua del documento cambia: si riprende la voce scelta per quella
  const [seenLang, setSeenLang] = React.useState(lang)
  if (seenLang !== lang) {
    setSeenLang(lang)
    setChoice(readVoiceChoice(lang))
  }

  const lastError = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (snap.error && snap.error !== lastError.current) toast.error(snap.error)
    lastError.current = snap.error
  }, [snap.error])

  const choose = (next: VoiceChoice) => {
    saveVoiceChoice(lang, next)
    setChoice(next)
    const resolved = resolveVoice(lang, next, system, neural, downloaded)
    if (resolved && snap.state !== "idle" && !sameVoice(resolved, voice)) {
      void reader.setVoice(resolved)
    }
  }

  // la velocità scelta l'ultima volta
  React.useEffect(() => {
    if (readerStore.get().state === "idle") reader.setRate(readRate())
  }, [])

  const setRate = (next: number) => {
    saveRate(next)
    reader.setRate(next)
  }

  const start = () => {
    stopPreview()
    if (!voice) return
    void reader.start(editor, voice, lang, rate).then(() => refreshDownloaded())
  }

  const reading = snap.state !== "idle"

  return (
    <RibbonGroup label="Voce" safe>
      <RibbonButton
        large
        label={reading ? "Interrompi lettura" : "Leggi ad alta voce"}
        title={
          supported
            ? "Legge il documento dal cursore, o solo il testo selezionato"
            : "Lettura ad alta voce non disponibile in questo browser"
        }
        disabled={!supported || !voice}
        active={reading}
        icon={
          reading ? (
            <Square className="size-5" />
          ) : (
            <Volume2 className="size-5" />
          )
        }
        onClick={() => (reading ? reader.stop() : start())}
      />
      <RibbonRows>
        <RibbonButton
          compact
          label={snap.state === "paused" ? "Riprendi" : "Pausa"}
          disabled={snap.state !== "playing" && snap.state !== "paused"}
          icon={
            snap.state === "paused" ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )
          }
          className="justify-start"
          onClick={() =>
            snap.state === "paused" ? reader.resume() : reader.pause()
          }
        />
        <RibbonMenu
          className="w-36"
          trigger={
            <RibbonButton
              compact
              chevron
              label={`Velocità ${formatRate(rate)}`}
              disabled={!supported}
              className="justify-start"
            />
          }
        >
          <DropdownMenuLabel>Velocità di lettura</DropdownMenuLabel>
          {RATES.map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => setRate(r)}
              className={cn(rate === r && "bg-accent")}
            >
              {formatRate(r)}
              {r === 1 ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  normale
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <VoicePicker
          lang={lang}
          rate={rate}
          system={system}
          neural={neural}
          downloaded={downloaded}
          onDownloaded={refreshDownloaded}
          current={voice}
          onChoose={choose}
          disabled={!supported}
        />
      </RibbonRows>
    </RibbonGroup>
  )
}

function VoicePicker({
  lang,
  rate,
  system,
  neural,
  downloaded,
  onDownloaded,
  current,
  onChoose,
  disabled,
}: {
  lang: string
  rate: number
  system: SpeechSynthesisVoice[]
  neural: NeuralVoice[]
  downloaded: Set<string>
  onDownloaded: () => void
  current: ReaderVoice | null
  onChoose: (choice: VoiceChoice) => void
  disabled: boolean
}) {
  const [progress, setProgress] = React.useState<Record<string, number>>({})
  const neuralAvailable = audioSupported()

  const download = (voice: NeuralVoice, then?: () => void) => {
    setProgress((p) => ({ ...p, [voice.id]: 0 }))
    Promise.all([
      loadPhonemizer(),
      loadVoice(voice, (fraction) =>
        setProgress((p) => ({ ...p, [voice.id]: fraction }))
      ),
    ])
      .then(() => {
        onDownloaded()
        then?.()
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "Download non riuscito"
        )
      )
      .finally(() =>
        setProgress((p) => {
          const next = { ...p }
          delete next[voice.id]
          return next
        })
      )
  }

  const label =
    current?.kind === "neural"
      ? current.voice.name
      : current?.voice
        ? current.voice.name.replace(/^(Microsoft|Google)\s+/, "")
        : "Voce"

  return (
    <Popover onOpenChange={(open) => !open && stopPreview()}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <RibbonButton
            compact
            label={label}
            title="Scegli la voce di lettura"
            icon={<Headphones className="size-4" />}
            className="max-w-[150px] justify-start"
          />
        }
      />
      <PopoverContent
        align="start"
        className="max-h-[min(70vh,560px)] w-[min(92vw,380px)] gap-0 overflow-y-auto p-0"
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="text-sm font-medium">Voce di lettura</div>
          <p className="text-xs text-muted-foreground">
            Si ricorda per ogni lingua. Lingua del documento: {lang}
          </p>
        </div>

        <section className="px-1.5 py-2">
          <h3 className="flex items-center gap-1.5 px-1.5 pb-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> Voci neurali Cogniva
          </h3>
          {!neuralAvailable ? (
            <p className="px-1.5 text-xs text-muted-foreground">
              Questo browser non supporta l&apos;audio necessario.
            </p>
          ) : !neural.length ? (
            <p className="px-1.5 text-xs text-muted-foreground">
              Ancora nessuna voce neurale per questa lingua.
            </p>
          ) : (
            neural.map((voice) => {
              const selected =
                current?.kind === "neural" && current.voice.id === voice.id
              const ready = downloaded.has(voice.id)
              const fraction = progress[voice.id]
              return (
                <div
                  key={voice.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-1.5 py-1.5",
                    selected ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    onClick={() => {
                      if (ready) onChoose({ kind: "neural", id: voice.id })
                      else if (fraction === undefined)
                        download(voice, () =>
                          onChoose({ kind: "neural", id: voice.id })
                        )
                    }}
                  >
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="size-4" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm">
                        {voice.name}{" "}
                        <span className="text-xs text-muted-foreground">
                          {voice.gender === "F" ? "femminile" : "maschile"} ·{" "}
                          {voice.lang}
                        </span>
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {voice.license} · {voice.credit}
                      </span>
                      {fraction !== undefined ? (
                        <span
                          role="progressbar"
                          aria-label={`Download di ${voice.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(fraction * 100)}
                          className="mt-1 block h-1 w-40 overflow-hidden rounded-full bg-muted"
                        >
                          <span
                            className="block h-full bg-primary transition-[width]"
                            style={{ width: `${Math.round(fraction * 100)}%` }}
                          />
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {fraction !== undefined ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(fraction * 100)}%
                    </span>
                  ) : ready ? (
                    <>
                      <IconButton
                        title={`Ascolta ${voice.name}`}
                        onClick={() => {
                          void previewNeuralVoice(voice, rate).catch(
                            (error: unknown) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Anteprima non riuscita"
                              )
                          )
                        }}
                      >
                        <Play className="size-3.5" />
                      </IconButton>
                      <IconButton
                        title={`Elimina ${voice.name} dal dispositivo`}
                        onClick={() => {
                          void deleteVoice(voice).then(() => {
                            onDownloaded()
                            toast.success(`${voice.name} eliminata`)
                          })
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton
                      title={`Scarica ${voice.name} (${megabytes(voice.bytes)} MB)`}
                      onClick={() => download(voice)}
                    >
                      <Download className="size-3.5" />
                      <span className="text-[11px] tabular-nums">
                        {megabytes(voice.bytes)} MB
                      </span>
                    </IconButton>
                  )}
                </div>
              )
            })
          )}
          <p className="px-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">
            Si scaricano una volta e poi funzionano offline: il testo non esce
            dal dispositivo. Motore Piper (MIT) con espeak-ng (GPL-3.0),
            caricato dalla sua CDN.
          </p>
        </section>

        <section className="border-t border-border px-1.5 py-2">
          <h3 className="px-1.5 pb-1 text-xs font-medium text-muted-foreground">
            Voci del sistema
          </h3>
          {!system.length ? (
            <p className="px-1.5 text-xs text-muted-foreground">
              {speechSupported()
                ? "Il sistema non ha voci per questa lingua: puoi aggiungerle dalle impostazioni di accessibilità del computer."
                : "Questo browser non ha voci di sistema."}
            </p>
          ) : (
            system.map((voice) => {
              const selected =
                current?.kind === "system" &&
                current.voice?.voiceURI === voice.voiceURI
              return (
                <div
                  key={voice.voiceURI}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1.5 py-1",
                    selected ? "bg-accent" : "hover:bg-muted"
                  )}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    onClick={() =>
                      onChoose({ kind: "system", uri: voice.voiceURI })
                    }
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {selected ? <Check className="size-4" /> : null}
                    </span>
                    <span className="truncate">{voice.name}</span>
                    {isNaturalVoice(voice) ? (
                      <span className="shrink-0 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                        Naturale
                      </span>
                    ) : null}
                    {!voice.localService ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        online
                      </span>
                    ) : null}
                  </button>
                  <IconButton
                    title={`Ascolta ${voice.name}`}
                    onClick={() => previewSystemVoice(voice, lang, rate)}
                  >
                    <Play className="size-3.5" />
                  </IconButton>
                </div>
              )
            })
          )}
        </section>
      </PopoverContent>
    </Popover>
  )
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
    >
      {children}
    </button>
  )
}

/** I comandi che restano a portata di mano mentre si ascolta */
export function ReadAloudBar() {
  const snap = useReader()
  if (snap.state === "idle") return null
  const loading = snap.state === "loading"
  const control =
    "flex size-8 items-center justify-center rounded-full text-foreground transition hover:bg-muted disabled:opacity-40"
  return (
    <div
      role="toolbar"
      aria-label="Lettura ad alta voce"
      className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-card/95 py-1 pr-1 pl-3 shadow-lg backdrop-blur">
        {loading ? (
          <span className="flex items-center gap-2 pr-2 text-xs text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {snap.download !== null && snap.download < 1
              ? `Scarico la voce… ${Math.round(snap.download * 100)}%`
              : "Preparo la voce…"}
          </span>
        ) : (
          <span className="hidden max-w-40 truncate pr-1 text-xs text-muted-foreground sm:inline">
            {snap.voiceName} · {snap.sentence + 1}/{snap.total}
          </span>
        )}
        <button
          type="button"
          className={control}
          disabled={loading}
          title="Paragrafo precedente"
          aria-label="Paragrafo precedente"
          onClick={() => reader.previous()}
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          className={cn(
            control,
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          disabled={loading}
          title={snap.state === "paused" ? "Riprendi" : "Pausa"}
          aria-label={snap.state === "paused" ? "Riprendi" : "Pausa"}
          onClick={() =>
            snap.state === "paused" ? reader.resume() : reader.pause()
          }
        >
          {snap.state === "paused" ? (
            <Play className="size-4" />
          ) : (
            <Pause className="size-4" />
          )}
        </button>
        <button
          type="button"
          className={control}
          disabled={loading}
          title="Paragrafo successivo"
          aria-label="Paragrafo successivo"
          onClick={() => reader.next()}
        >
          <SkipForward className="size-4" />
        </button>
        <RateCycle rate={snap.rate} />
        <button
          type="button"
          className={control}
          title="Interrompi lettura"
          aria-label="Interrompi lettura"
          onClick={() => reader.stop()}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}

function RateCycle({ rate }: { rate: number }) {
  return (
    <button
      type="button"
      title="Velocità: clic per cambiarla"
      aria-label={`Velocità ${formatRate(rate)}`}
      className="flex h-8 min-w-12 items-center justify-center gap-0.5 rounded-full px-2 text-xs tabular-nums hover:bg-muted"
      onClick={() => {
        const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1
        saveRate(next)
        reader.setRate(next)
      }}
    >
      {formatRate(rate)}
      <ChevronDown className="size-3 opacity-50" />
    </button>
  )
}
