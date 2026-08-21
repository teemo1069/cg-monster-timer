import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "github",
  base: "/cg-monster-timer/",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-github",
    emptyOutDir: true,
    sourcemap: false,
  },
});
