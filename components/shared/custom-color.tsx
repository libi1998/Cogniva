"use client"

import * as React from "react"

export function CustomColor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = React.useState(value)
  const [lastValue, setLastValue] = React.useState(value)
  if (lastValue !== value) {
    setLastValue(value)
    setDraft(value)
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-1.5 py-1">
      <label className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-[6px] ring-1 ring-black/10">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const v = e.target.value.trim()
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v)
        }}
        spellCheck={false}
        className="w-full min-w-0 bg-transparent font-mono text-[11px] uppercase outline-none"
      />
    </div>
  )
}
