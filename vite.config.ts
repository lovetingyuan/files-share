import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babelPlugin from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import babelPluginRelativePath from "./scripts/babel-plugin-relative-path.js";
import { execSync } from "child_process";

process.env.VITE_BUILD_TIME = new Date().toLocaleString();
// eslint-disable-next-line sonarjs/no-os-command-from-path
process.env.VITE_GIT_HASH = execSync("git rev-parse --short HEAD").toString("utf8").trim();

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
