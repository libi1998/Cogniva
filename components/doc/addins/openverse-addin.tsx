"use client"

import * as React from "react"
import { ArrowLeft, ExternalLink, LoaderCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { paragraph, type AddinApi } from "./api"

import { useT, tr } from "@/lib/i18n/client"
/**
 * Immagini libere da Openverse (WordPress): Creative Commons e pubblico
 * dominio. L'immagine entra con autore, licenza e fonte nella didascalia.
 */

type Result = {
  id: string
  title: string
  url: string
  thumbnail: string
  creator: string
  creatorUrl: string | null
  license: string
  licenseVersion: string
  licenseUrl: string | null
  landing: string | null
  provider: string
}

const safe = (url: string | null | undefined) =>
  url && /^https:\/\//.test(url) ? url : null

const licenseName = (r: Result) =>
  r.license === "cc0"
    ? "CC0"
    : r.license === "pdm"
      ? tr("Pubblico dominio")
      : `CC ${r.license.toUpperCase()} ${r.licenseVersion}`.trim()

async function search(
  q: string,
  commercial: boolean,
  signal: AbortSignal
): Promise<Result[]> {
  const params = new URLSearchParams({ q, page_size: "24", mature: "false" })
  if (commercial) params.set("license_type", "commercial")
  const response = await fetch(
    `https://api.openverse.org/v1/images/?${params}`,
    { signal }
  )
  if (response.status === 429)
    throw new Error(tr("Troppe ricerche: riprova fra un minuto."))
  if (!response.ok) throw new Error(tr("Openverse non risponde"))
  const data = (await response.json()) as {
    results?: {
      id: string
      title?: string
      url?: string
      thumbnail?: string
      creator?: string
      creator_url?: string
      license: string
      license_version?: string
      license_url?: string
      foreign_landing_url?: string
      provider?: string
    }[]
  }
  return (data.results ?? []).flatMap((r) => {
    const url = safe(r.url)
    const thumbnail = safe(r.thumbnail) ?? url
    if (!url || !thumbnail) return []
    return [
      {
        id: r.id,
        title: r.title || tr("Senza titolo"),
        url,
        thumbnail,
        creator: r.creator || tr("Autore sconosciuto"),
        creatorUrl: safe(r.creator_url),
        license: r.license,
        licenseVersion: r.license_version ?? "",
        licenseUrl: safe(r.license_url),
        landing: safe(r.foreign_landing_url),
        provider: r.provider ?? "",
      },
    ]
  })
}

export function OpenverseAddin({ api }: { api: AddinApi }) {
  const t = useT()
  const [query, setQuery] = React.useState(() =>
    api.selectionText().slice(0, 60)
  )
  const [commercial, setCommercial] = React.useState(true)
  const [results, setResults] = React.useState<Result[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [chosen, setChosen] = React.useState<Result | null>(null)

  React.useEffect(() => {
    const q = query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (q.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      search(q, commercial, controller.signal)
        .then((list) => {
          setResults(list)
          setError(list.length ? "" : t("Nessuna immagine trovata."))
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return
          setError(e instanceof Error ? e.message : t("Ricerca non riuscita"))
        })
        .finally(() => !controller.signal.aborted && setLoading(false))
    }, 400)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, commercial, t])

  if (chosen) {
    const insert = () =>
      api.insertContent([
        {
          type: "image",
          attrs: { src: chosen.url, alt: chosen.title, width: "70%" },
        },
        paragraph([
          {
            text: `«${chosen.title}»`,
            href: chosen.landing ?? undefined,
            italic: true,
          },
          { text: ` ${t("di")} `, italic: true },
          {
            text: chosen.creator,
            href: chosen.creatorUrl ?? undefined,
            italic: true,
          },
          { text: ", ", italic: true },
          {
            text: licenseName(chosen),
            href: chosen.licenseUrl ?? undefined,
            italic: true,
          },
        ]),
      ])
    return (
      <div className="space-y-3 p-3">
        <button
          type="button"
          onClick={() => setChosen(null)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("Risultati")}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine remota scelta dall'utente */}
        <img
          src={chosen.thumbnail}
          alt={chosen.title}
          className="w-full rounded-md object-contain"
        />
        <dl className="space-y-1 text-xs">
          <div>
            <dt className="text-muted-foreground">{t("Titolo")}</dt>
            <dd className="text-sm">{chosen.title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Autore")}</dt>
            <dd>{chosen.creator}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("Licenza")}</dt>
            <dd>{licenseName(chosen)}</dd>
          </div>
        </dl>
        <Button type="button" className="w-full" onClick={insert}>
          {t("Inserisci con autore e licenza")}
        </Button>
        {chosen.landing ? (
          <a
            href={chosen.landing}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />{" "}
            {t("Pagina dell'immagine ({provider})", {
              provider: chosen.provider,
            })}
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t("Cerca immagini libere")}
          className="h-8 pl-7"
          value={query}
          placeholder={t("Cerca immagini (in inglese trovi di più)")}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={commercial}
          onChange={(e) => setCommercial(e.target.checked)}
        />
        {t("Solo uso commerciale consentito")}
      </label>
      {loading ? (
        <LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : null}
      {error && !loading ? (
        <p className="text-xs text-muted-foreground">{error}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5">
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            title={`${r.title} — ${r.creator}`}
            aria-label={`${r.title} — ${r.creator}`}
            onClick={() => setChosen(r)}
            className={cn(
              "aspect-square overflow-hidden rounded-md bg-muted hover:ring-2 hover:ring-primary"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- miniature remote di Openverse */}
            <img
              src={r.thumbnail}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t(
          "Le parole cercate vanno a api.openverse.org; le immagini si caricano dai siti che le ospitano. Controlla sempre la licenza prima di pubblicare."
        )}
      </p>
    </div>
  )
}
