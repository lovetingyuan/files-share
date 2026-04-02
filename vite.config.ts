import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babelPlugin from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import babelPluginRelativePath from "./scripts/babel-plugin-relative-path.js";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babelPlugin({
      presets: [reactCompilerPreset()],
      plugins: mode === "development" ? [babelPluginRelativePath] : [],
    }),
    tailwindcss(),
    cloudflare(),
  ],
}));
