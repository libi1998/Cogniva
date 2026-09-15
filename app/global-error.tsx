"use client"

/**
 * Errore nel layout principale: questa pagina sostituisce tutto il documento
 * e non ha i fogli di stile dell'app, quindi gli stili sono in linea e il
 * tema segue quello del sistema.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="it">
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
        <title>Qualcosa è andato storto · Cogniva</title>
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
            Qualcosa è andato storto
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: "0 0 20px" }}>
            I file restano salvati in questo browser. Ricarica la pagina per
            riprendere il lavoro.
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
            Riprova
          </button>
        </div>
      </body>
    </html>
  )
}
