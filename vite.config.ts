import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart({ target: "node-server" }),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Polling necessário quando o source está montado dentro de um container Docker no Windows/macOS.
    watch: process.env.DOCKER === "true" ? { usePolling: true } : undefined,
  },
});
