import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react cerca da solo la versione di React con un'API che
    // ESLint 10 ha tolto: indicarla evita il controllo
    settings: { react: { version: "19.3" } },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/ort/**",
    "test-results/**",
    "playwright-report/**",
  ]),
])

export default eslintConfig
