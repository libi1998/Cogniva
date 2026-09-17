import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

/** Il fonetizzatore delle voci Piper (espeak-ng), caricato solo se si usano */
const PIPER_WASM =
  "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/"

/**
 * Content Security Policy compatibile con il prerender: senza nonce (che
 * obbligherebbe a rendere dinamica ogni pagina) gli script inline di Next
 * restano ammessi, ma tutto il resto è chiuso. Le sole origini esterne sono
 * quelle che l'app usa davvero: i lettori video incorporati nei documenti
 * (YouTube, Vimeo, Loom, Dailymotion), le immagini prese da un indirizzo web
 * e i modelli scaricati una volta per traduzione e voci neurali.
 */
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' permette solo di compilare WebAssembly (traduzione e
  // voci neurali sul dispositivo), non eval; il fonetizzatore delle voci si
  // carica da un solo indirizzo fisso, con impronta SRI
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${PIPER_WASM}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' data: blob: https:${isDev ? " ws: wss:" : ""}`,
  "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com https://www.dailymotion.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // niente plugin, niente <embed>: l'app non ne usa
  "manifest-src 'self'",
  // un'immagine inserita con un indirizzo http:// viaggerebbe in chiaro:
  // il browser la richiede in https. In sviluppo il sito è in chiaro, quindi
  // la regola vale solo in produzione
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // nessun altro sito può tirarsi dentro le risorse dell'app
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // ogni pagina in un processo suo, anche fra sottodomini
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    // il microfono serve alla dettatura e la condivisione dello schermo alla
    // schermata da inserire nei documenti; tutto il resto no
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "hid=()",
      "midi=()",
      "idle-detection=()",
      "local-fonts=()",
      "xr-spatial-tracking=()",
      "browsing-topics=()",
      "interest-cohort=()",
      "microphone=(self)",
      "display-capture=(self)",
    ].join(", "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
]

const nextConfig: NextConfig = {
  // memoizzazione automatica dei componenti: board ed editor ridisegnano solo
  // quello che cambia
  reactCompiler: true,
  // ogni pagina ha una shell prerenderizzata servita subito; i dati (che
  // vivono nel browser) arrivano dopo. Le pagine visitate restano vive
  // nascoste, così tornare indietro è istantaneo
  cacheComponents: true,
  // i link scaricano in anticipo la shell di ogni route, una volta sola
  partialPrefetching: true,
  // href controllati da TypeScript: un link a una pagina che non esiste non
  // compila
  typedRoutes: true,
  poweredByHeader: false,
  // l'indicatore di sviluppo coprirebbe lo zoom in basso a sinistra; gli
  // errori si vedono comunque
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
