import { HomeScreen } from "@/components/home/home-screen"

// il titolo «Cogniva» arriva dal layout; la home lo rimette da sola quando
// torna visibile (useDocumentTitle)
export default function Page() {
  return <HomeScreen />
}
