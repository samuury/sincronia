// Wrapper Node HTTP que pluga o fetch handler bundleado pelo TanStack Start
// (dist/server/server.js exporta { default: { fetch(request) } }) num server
// real com listen(). Sem isso o processo termina sem abrir porta.

import { createServer } from "node:http";
import { Readable } from "node:stream";

const mod = await import("./dist/server/server.js");
const handler = mod.default ?? mod;

if (typeof handler?.fetch !== "function") {
  console.error("[server] dist/server/server.js não exporta um handler { fetch }. Conteúdo:", handler);
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const HOST = "0.0.0.0";

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

const server = createServer(async (req, res) => {
  try {
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
