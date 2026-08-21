// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions laeuft unter Deno, nicht unter Node/Expo: eigene
    // Globals (Deno.serve), eigene Importform (jsr:). Die Expo-Regeln kennen
    // beides nicht und melden nur Falsches.
    ignores: ["dist/*", "supabase/functions/*"],
  },
  {
    // Farbliterale sind laut CLAUDE.md verboten - Farben kommen ausschliesslich
    // aus src/design/tokens.ts. Bisher war das Disziplin; ab hier meldet es der
    // Linter.
    //
    // Geprueft wird auf Literale wie '#3B6C82', 'rgb(...)' und 'rgba(...)'.
    // Nicht geprueft werden Farbnamen ('red'): die kaemen in diesem Projekt
    // ohnehin nur aus Versehen vor, und eine Namensliste waere mehr Regel als
    // Nutzen.
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
          message:
            "Kein Farbliteral - nimm einen Token aus src/design/tokens.ts (CLAUDE.md §Verboten).",
        },
        {
          selector: "Literal[value=/^rgba?\\(/]",
          message:
            "Kein Farbliteral - nimm einen Token aus src/design/tokens.ts (CLAUDE.md §Verboten).",
        },
      ],
    },
  },
  {
    // tokens.ts IST die Stelle, an der die Farben stehen duerfen. Und in Tests
    // steht mal ein Hexwert als erwarteter Wert - das ist kein Styling.
    files: ["src/design/tokens.ts", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
