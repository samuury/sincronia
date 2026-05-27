import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    // @ts-ignore
    tanstackStart({ target: "node-server" }),
    viteReact(),
    tailwindcss(),
    {
      name: "stream-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method === 'POST' && req.originalUrl === '/api/stream-chapter') {
            const { handleStreamChapter } = await import("./src/lib/stream-handler.mjs");
            return handleStreamChapter(req, res);
          }
          next();
        });
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Polling necessário quando o source está montado dentro de um container Docker no Windows/macOS.
    watch: process.env.DOCKER === "true" ? { usePolling: true } : undefined,
  },
});
