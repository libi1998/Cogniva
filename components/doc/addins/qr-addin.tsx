"use client"

import * as React from "react"
import QRCode from "qrcode"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AddinApi } from "./api"

type Kind = "text" | "wifi" | "email" | "phone"

const KINDS: { value: Kind; label: string }[] = [
  { value: "text", label: "Link o testo" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefono" },
]

const LEVELS = [
  { value: "L", label: "Bassa (7%)" },
  { value: "M", label: "Media (15%)" },
  { value: "Q", label: "Alta (25%)" },
  { value: "H", label: "Massima (30%)" },
] as const

/** Nel formato Wi-Fi i caratteri speciali vanno protetti */
const wifiEscape = (value: string) => value.replace(/([\;,:"])/g, "\\$1")

export function QrAddin({ api }: { api: AddinApi }) {
  const [kind, setKind] = React.useState<Kind>("text")
  const [text, setText] = React.useState(
    () => api.selectionText() || "https://"
  )
  const [ssid, setSsid] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [security, setSecurity] = React.useState("WPA")
  const [email, setEmail] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [color, setColor] = React.useState("#18181b")
  const [transparent, setTransparent] = React.useState(false)
  const [level, setLevel] =
    React.useState<(typeof LEVELS)[number]["value"]>("M")
  const [width, setWidth] = React.useState(30)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [error, setError] = React.useState("")

  const payload =
    kind === "text"
      ? text.trim()
      : kind === "wifi"
        ? ssid.trim()
          ? `WIFI:T:${security};S:${wifiEscape(ssid.trim())};${security === "nopass" ? "" : `P:${wifiEscape(password)};`};`
          : ""
        : kind === "email"
          ? email.trim()
            ? `mailto:${email.trim()}${subject.trim() ? `?subject=${encodeURIComponent(subject.trim())}` : ""}`
            : ""
          : phone.trim()
            ? `tel:${phone.replace(/[^\d+]/g, "")}`
            : ""

  React.useEffect(() => {
    let live = true
    if (!payload || payload === "https://") {
      void Promise.resolve().then(() => live && setPreview(null))
      return
    }
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: level,
      margin: 2,
      width: 768,
      color: { dark: color, light: transparent ? "#0000" : "#ffffff" },
    })
      .then((url) => {
        if (!live) return
        setPreview(url)
        setError("")
      })
      .catch(() => {
        if (!live) return
        setPreview(null)
        setError("Il testo è troppo lungo per un codice QR.")
      })
    return () => {
      live = false
    }
  }, [payload, level, color, transparent])

  const field = "space-y-1 block"
  const label = "text-xs font-medium text-muted-foreground"

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn(
              "h-7 rounded text-xs",
              kind === k.value
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "text" ? (
        <label className={field}>
          <span className={label}>Contenuto</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
      ) : kind === "wifi" ? (
        <>
          <label className={field}>
            <span className={label}>Nome della rete (SSID)</span>
            <Input
              className="h-8"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
            />
          </label>
          <label className={field}>
            <span className={label}>Sicurezza</span>
            <select
              value={security}
              onChange={(e) => setSecurity(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="WPA">WPA/WPA2/WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">Nessuna</option>
            </select>
          </label>
          {security !== "nopass" ? (
            <label className={field}>
              <span className={label}>Password</span>
              <Input
                className="h-8"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : null}
        </>
      ) : kind === "email" ? (
        <>
          <label className={field}>
            <span className={label}>Indirizzo</span>
            <Input
              className="h-8"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={field}>
            <span className={label}>Oggetto (facoltativo)</span>
            <Input
              className="h-8"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
        </>
      ) : (
        <label className={field}>
          <span className={label}>Numero</span>
          <Input
            className="h-8"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      )}

      <div className="flex items-center justify-center rounded-lg border border-border bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- anteprima generata nel browser
          <img
            src={preview}
            alt="Anteprima del codice QR"
            className="size-40"
            data-testid="qr-preview"
          />
        ) : (
          <span className="flex size-40 items-center justify-center text-center text-xs text-muted-foreground">
            {error || "Scrivi il contenuto del codice"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label className={field}>
          <span className={label}>Colore</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-full cursor-pointer rounded-md border border-input bg-transparent"
          />
        </label>
        <label className={field}>
          <span className={label}>Correzione errori</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
            className="h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-1 text-xs"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={transparent}
          onChange={(e) => setTransparent(e.target.checked)}
        />
        Sfondo trasparente
      </label>
      <label className={field}>
        <span className={cn(label, "flex justify-between")}>
          Larghezza nel documento <span className="tabular-nums">{width}%</span>
        </span>
        <input
          type="range"
          min={10}
          max={100}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <Button
        type="button"
        className="w-full"
        disabled={!preview}
        onClick={() =>
          preview &&
          api.insertImage(
            preview,
            `Codice QR: ${kind === "wifi" ? `rete Wi-Fi ${ssid}` : payload}`,
            `${width}%`
          )
        }
      >
        Inserisci codice QR
      </Button>
    </div>
  )
}
