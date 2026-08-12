import assert from "node:assert/strict";
import test from "node:test";
import type { Express } from "express";
import { detectImageFormat, validateImageUpload } from "./media.js";
import { HttpError } from "./http-error.js";

function file(buffer: Buffer, mimetype: string): Express.Multer.File {
  return {
    buffer,
    mimetype,
    size: buffer.length,
    fieldname: "file",
    originalname: "upload",
    encoding: "7bit",
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never
  };
}

test("detects supported image signatures", () => {
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "jpg");
  assert.equal(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectImageFormat(Buffer.from("RIFF0000WEBP", "ascii")), "webp");
});

test("rejects MIME and signature mismatch", () => {
  assert.throws(
    () => validateImageUpload(file(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/png")),
    HttpError
  );
});
