import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { createPostRoutes } from "../modules/posts/interfaces/http/post.routes.ts";
import { errorHandler } from "../shared/interfaces/http/error-handler.ts";

const app = express();
const authenticated = async (_request, _response, next) => next();
const uploaded = async (request, response) => response.json({ bytes: request.file?.size });
app.use("/posts", createPostRoutes({
  auth: { requireAuth: authenticated, optionalAuth: authenticated },
  postController: { uploadMedia: uploaded, analyzeImage: uploaded }
}));
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const baseUrl = `http://127.0.0.1:${server.address().port}`;
try {
  for (const path of ["/posts/fixture/media", "/posts/analyze-image"]) {
    const boundary = "lnfs-upload-regression";
    const body = ["audit[4294967294]", "audit[]"].map(name =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\nvalue\r\n`
    ).join("") + `--${boundary}--\r\n`;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST", headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` }, body
    });
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type"), /application\/json/);
    await response.json();
  }
  const form = new FormData();
  form.append("file", new Blob(["image fixture"], { type: "image/png" }), "fixture.png");
  const response = await fetch(`${baseUrl}/posts/fixture/media`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { bytes: 13 });
  console.info("upload_process_survived");
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
