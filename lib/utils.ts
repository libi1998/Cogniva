export { cn } from "cn"

/**
 * Una data come «2025-12-31» nel fuso di chi usa l'app. `toISOString` è in
 * UTC: fra mezzanotte e l'una (le due d'estate) in Italia dava ancora ieri.
 */
export function localDateStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
