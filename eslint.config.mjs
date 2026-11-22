import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { FlatCompat } from "@eslint/eslintrc"

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "supabase/functions/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Código heredado con mucho `any`; se limpia de a poco.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "off",
      // Evita reintroducir logs con datos personales en el navegador/servidor.
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
]

export default config
