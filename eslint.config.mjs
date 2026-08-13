import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

// ESLint 9 usa "flat config". O eslint-config-next ainda vem no formato antigo,
// então entra pelo FlatCompat.
export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      "supabase/**",
      // scripts pontuais de auditoria/recuperação, rodados à mão
      "scripts/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // O projeto usa `any` em pontos de fronteira com a API da Evolution e com
      // o supabase-js sem tipos gerados; avisa em vez de quebrar o build.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
