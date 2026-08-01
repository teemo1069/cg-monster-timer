import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "github",
  base: "/cg-monster-timer/",
  plugins: [react()],
  build: {
    outDir: "../dist-github",
    emptyOutDir: true,
  },
});
