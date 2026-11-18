import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createPostController } from "./post.controller.js";
import type { ImageAnalysisUseCases } from "../../application/image-analysis.use-cases.js";
import type { PostUseCases } from "../../application/post.use-cases.js";
import type { IllustrationUseCases } from "../../application/illustration.use-cases.js";

test("post image analysis selects default, Florence and consented Gemini explicitly", async () => {
  const calls: string[] = [];
  const service = (name: string) => ({ analyzePostImages: async () => { calls.push(name); return { model: name }; } }) as unknown as ImageAnalysisUseCases;
  const controller = createPostController({ postService: {} as PostUseCases, illustrations: {} as IllustrationUseCases,
    geminiImageService: service("default"), florenceImageService: service("florence"), externalGeminiImageService: service("gemini") });
  const headers: Record<string, string> = {};
  let result: unknown;
  const response = { setHeader: (name: string, value: string) => { headers[name] = value; }, json: (value: unknown) => { result = value; } } as unknown as Response;
  const request = (provider?: string, externalConsent?: string) => ({ body: { type: "LOST", ...(provider ? { provider } : {}), ...(externalConsent ? { externalConsent } : {}) },
    files: [{ buffer: Buffer.from("image"), mimetype: "image/jpeg", size: 5 }] }) as unknown as Request;
  await controller.analyzeImage(request(), response);
  assert.deepEqual(result, { model: "default" });
  await controller.analyzeImage(request("florence"), response);
  assert.deepEqual(result, { model: "florence" });
  await assert.rejects(controller.analyzeImage(request("gemini"), response), { status: 400 });
  await controller.analyzeImage(request("gemini", "true"), response);
  assert.deepEqual(result, { model: "gemini" });
  assert.deepEqual(calls, ["default", "florence", "gemini"]);
  assert.equal(headers["Cache-Control"], "private, no-store");
});

test("Gemini is not silently substituted when unavailable", async () => {
  const controller = createPostController({ postService: {} as PostUseCases, illustrations: {} as IllustrationUseCases,
    geminiImageService: { analyzePostImages: async () => { throw new Error("default called"); } } as ImageAnalysisUseCases });
  const request = { body: { type: "FOUND", provider: "gemini", externalConsent: "true" },
    files: [{ buffer: Buffer.from("image"), mimetype: "image/jpeg", size: 5 }] } as unknown as Request;
  await assert.rejects(controller.analyzeImage(request, {} as Response), { status: 503 });
});
