import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(__dirname, "..");
const appDir = path.join(skillDir, "assets", "intake-app");
const submissionsDir = path.join(skillDir, "data", "submissions");
const preferredPort = Number(process.env.PORT || 4177);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(appDir, requestedPath);

  if (!filePath.startsWith(appDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function createIntakeServer() {
  return createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/submissions") {
    try {
      const body = await readBody(request);
      const payload = JSON.parse(body);
      await mkdir(submissionsDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outputPath = path.join(submissionsDir, `submission-${stamp}.json`);
      await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
      sendJson(response, 201, { ok: true, path: outputPath });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
  });
}

function listen(port, attemptsLeft = 10) {
  const server = createIntakeServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Founder P&L intake running at http://127.0.0.1:${port}`);
    console.log(`Submissions will be saved to ${submissionsDir}`);
  });
}

listen(preferredPort);
