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
  }
]);
