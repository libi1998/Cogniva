"use client"

/**
 * Errore nel layout principale: questa pagina sostituisce tutto il documento
 * e non ha né i fogli di stile né le traduzioni dell'app, quindi gli stili
 * sono in linea, il tema segue quello del sistema e i pochi testi sono qui,
 * nella lingua dell'indirizzo o del browser.
 */

const TEXTS = {
  it: {
    title: "Qualcosa è andato storto",
    body: "I file restano salvati in questo browser. Ricarica la pagina per riprendere il lavoro.",
    retry: "Riprova",
  },
  en: {
    title: "Something went wrong",
    body: "Your files are still saved in this browser. Reload the page to get back to work.",
    retry: "Try again",
  },
  es: {
    title: "Algo salió mal",
    body: "Tus archivos siguen guardados en este navegador. Recarga la página para seguir trabajando.",
    retry: "Reintentar",
  },
  fr: {
    title: "Un problème est survenu",
    body: "Vos fichiers restent enregistrés dans ce navigateur. Rechargez la page pour reprendre votre travail.",
    retry: "Réessayer",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Deine Dateien sind weiterhin in diesem Browser gespeichert. Lade die Seite neu, um weiterzuarbeiten.",
    retry: "Erneut versuchen",
  },
  pt: {
    title: "Algo deu errado",
    body: "Seus arquivos continuam salvos neste navegador. Recarregue a página para continuar trabalhando.",
    retry: "Tentar novamente",
  },
} as const

function pickLocale(): keyof typeof TEXTS {
  if (typeof window === "undefined") return "en"
  const fromPath = window.location.pathname.split("/")[1]
  if (fromPath && fromPath in TEXTS) return fromPath as keyof typeof TEXTS
  const fromBrowser = navigator.language.slice(0, 2)
  return fromBrowser in TEXTS ? (fromBrowser as keyof typeof TEXTS) : "en"
}

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const locale = pickLocale()
  const text = TEXTS[locale]
  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          colorScheme: "light dark",
          background: "Canvas",
          color: "CanvasText",
          textAlign: "center",
        }}
      >
        <title>{`${text.title} · Cogniva`}</title>
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>{text.title}</h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
            {text.body}
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, opacity: 0.5, fontFamily: "monospace" }}>
              {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: "inherit",
              fontSize: 14,
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "#4f39f6",
              color: "#fff",
            }}
          >
            {text.retry}
          </button>
        </div>
      </body>
    </html>
  )
}
