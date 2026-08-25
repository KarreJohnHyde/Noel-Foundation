import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverDirectory = resolve("dist/server");
const workerPath = resolve(serverDirectory, "index.js");

const workerSource = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || request.method !== "GET" || !acceptsHtml) {
      return response;
    }

    const indexUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(indexUrl, { headers: request.headers }));
  },
};
`;

await mkdir(serverDirectory, { recursive: true });
await writeFile(workerPath, workerSource, "utf8");
