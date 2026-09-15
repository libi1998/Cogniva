"use client"

import * as React from "react"
import { ArrowLeft, ExternalLink, LoaderCircle, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { paragraph, type AddinApi } from "./api"

/**
 * Wikipedia: ricerca nella lingua del documento e riassunto della voce, con
 * l'attribuzione che la licenza CC BY-SA 4.0 chiede. Le ricerche vanno a
 * wikipedia.org, e il riquadro lo dice.
 */

const LANGS = [
  ["it", "Italiano"],
  ["en", "Inglese"],
  ["fr", "Francese"],
  ["de", "Tedesco"],
  ["es", "Spagnolo"],
  ["pt", "Portoghese"],
] as const

type Hit = {
  key: string
  title: string
  description: string
  thumbnail: string | null
}
type Summary = {
  title: string
  extract: string
  url: string
  thumbnail: string | null
  description: string
}

const https = (url: string | undefined | null) =>
  url
    ? url.startsWith("//")
      ? `https:${url}`
      : url.startsWith("https://")
        ? url
        : null
    : null

async function searchWikipedia(
  lang: string,
  q: string,
  signal: AbortSignal
): Promise<Hit[]> {
  const url = `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=10`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error("Wikipedia non risponde")
  const data = (await response.json()) as {
    pages?: {
      key: string
      title: string
      description?: string | null
      thumbnail?: { url?: string } | null
    }[]
  }
  return (data.pages ?? []).map((p) => ({
    key: p.key,
    title: p.title,
    description: p.description ?? "",
    thumbnail: https(p.thumbnail?.url),
  }))
}

async function summary(lang: string, key: string): Promise<Summary> {
  const response = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`
  )
  if (!response.ok) throw new Error("Voce non trovata")
  const data = (await response.json()) as {
    title: string
    extract?: string
    description?: string
    content_urls?: { desktop?: { page?: string } }
    thumbnail?: { source?: string }
  }
  return {
    title: data.title,
    extract: data.extract ?? "",
    description: data.description ?? "",
    url:
      https(data.content_urls?.desktop?.page) ??
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(key)}`,
    thumbnail: https(data.thumbnail?.source),
  }
}

export function WikipediaAddin({ api }: { api: AddinApi }) {
  const [lang, setLang] = React.useState(() => {
    const code = api.language.slice(0, 2)
    return LANGS.some(([c]) => c === code) ? code : "it"
  })
  const [query, setQuery] = React.useState(() =>
    api.selectionText().slice(0, 80)
  )
  const [hits, setHits] = React.useState<Hit[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [page, setPage] = React.useState<Summary | null>(null)

  React.useEffect(() => {
    const q = query.trim()
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (!q) {
        setHits([])
        return
      }
      setLoading(true)
      searchWikipedia(lang, q, controller.signal)
        .then((list) => {
          setHits(list)
          setError("")
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return
          setError(e instanceof Error ? e.message : "Ricerca non riuscita")
        })
        .finally(() => !controller.signal.aborted && setLoading(false))
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, lang])

  const open = (hit: Hit) => {
    setLoading(true)
    summary(lang, hit.key)
      .then(setPage)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Voce non disponibile")
      )
      .finally(() => setLoading(false))
  }

  const credit = (p: Summary) =>
    paragraph([
      { text: "Fonte: ", italic: true },
      { text: `«${p.title}»`, href: p.url, italic: true },
      { text: ", Wikipedia, licenza ", italic: true },
      {
        text: "CC BY-SA 4.0",
        href: "https://creativecommons.org/licenses/by-sa/4.0/deed.it",
        italic: true,
      },
    ])

  if (page) {
    return (
      <div className="space-y-3 p-3">
        <button
          type="button"
          onClick={() => setPage(null)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Risultati
        </button>
        {page.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura di Wikimedia
          <img
            src={page.thumbnail}
            alt=""
            className="max-h-40 rounded-md object-cover"
          />
        ) : null}
        <div>
          <h3 className="text-base font-semibold">{page.title}</h3>
          {page.description ? (
            <p className="text-xs text-muted-foreground">{page.description}</p>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed" data-testid="wikipedia-extract">
          {page.extract}
        </p>
        <div className="grid gap-2">
          <Button
            type="button"
            onClick={() =>
              api.insertContent([paragraph([page.extract]), credit(page)])
            }
          >
            Inserisci riassunto con la fonte
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              api.insertContent(
                paragraph([{ text: page.title, href: page.url }])
              )
            }
          >
            Inserisci collegamento alla voce
          </Button>
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="size-3.5" /> Apri su Wikipedia
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Cerca su Wikipedia"
            className="h-8 pl-7"
            value={query}
            placeholder="Cerca una voce"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Lingua di Wikipedia"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="h-8 w-[84px] rounded-md border border-input bg-transparent px-1 text-xs"
        >
          {LANGS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <LoaderCircle className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ul className="space-y-0.5">
        {hits.map((hit) => (
          <li key={hit.key}>
            <button
              type="button"
              onClick={() => open(hit)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              {hit.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura di Wikimedia
                <img
                  src={hit.thumbnail}
                  alt=""
                  className="size-9 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="size-9 shrink-0 rounded bg-muted" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm">{hit.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {hit.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Le parole cercate vengono inviate a wikipedia.org. I testi di Wikipedia
        sono disponibili con licenza CC BY-SA 4.0.
      </p>
    </div>
  )
}
