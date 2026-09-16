import { NextResponse, type NextRequest } from "next/server"
import {
  isLocale,
  LOCALE_COOKIE,
  localePath,
  negotiateLocale,
  splitLocalePath,
} from "@/lib/i18n/config"

/**
 * Ogni pagina ha la lingua nell'indirizzo (/it, /en…). Chi arriva senza
 * lingua va in quella scelta l'ultima volta (cookie) oppure in quella del
 * browser; se l'app non la conosce, in inglese.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (splitLocalePath(pathname).locale) return NextResponse.next()

  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  const locale = isLocale(saved)
    ? saved
    : negotiateLocale(request.headers.get("accept-language"))

  const url = request.nextUrl.clone()
  url.pathname = localePath(locale, pathname)
  url.search = search
  const response = NextResponse.redirect(url)
  response.headers.set("Vary", "Accept-Language, Cookie")
  return response
}

export const config = {
  // niente file statici, risorse di Next e motori WebAssembly
  matcher: ["/((?!_next/|ort/|.*\\..*).*)"],
}
