// Wrapper Node HTTP que:
//   1) Serve estáticos de dist/client/ (CSS, JS, imagens, fonts).
//   2) Pluga o fetch handler do TanStack Start (dist/server/server.js) para SSR.
// Sem (1) o HTML carrega mas tudo fica sem estilo / sem JS / sem imagens.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "dist", "client");

const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const mod = await import("./dist/server/server.js");
const handler = mod.default ?? mod;

if (typeof handler?.fetch !== "function") {
  console.error("[server] dist/server/server.js não exporta um handler { fetch }. Conteúdo:", handler);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";

// ───── estáticos ─────────────────────────────────────────────────────────

async function tryServeStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  // Deixa o SSR tomar conta do root e de qualquer rota .html.
  if (decodedPath === "/" || decodedPath.endsWith(".html")) return false;

  const filePath = path.join(CLIENT_DIR, decodedPath);
  // Previne path traversal (`/../etc/passwd`).
  if (!filePath.startsWith(CLIENT_DIR + path.sep)) return false;

  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("content-type", mime);
  res.setHeader("content-length", String(stats.size));
  // /assets/* tem hash no nome → imutável e cache longo.
  if (decodedPath.startsWith("/assets/")) {
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("cache-control", "public, max-age=3600");
  }

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });
  return true;
}

// ───── adapter Node ↔ Fetch ──────────────────────────────────────────────

function nodeRequestToFetchRequest(req) {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const init = { method: req.method, headers };

  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function writeFetchResponseToNode(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}

// ───── server ────────────────────────────────────────────────────────────
import { handleStreamChapter } from "./src/lib/stream-handler.mjs";

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === 'POST' && url.pathname === '/api/stream-chapter') {
      return handleStreamChapter(req, res);
    }

    // 1) estáticos primeiro
    const served = await tryServeStatic(req, res, url.pathname);
    if (served) return;

    // 2) SSR / server functions
    const request = nodeRequestToFetchRequest(req);
    const response = await handler.fetch(request);
    await writeFetchResponseToNode(response, res);
  } catch (error) {
    console.error("[server] request error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✓ Server listening on http://${HOST}:${PORT}`);
});
