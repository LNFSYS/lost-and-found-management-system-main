import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOriginAllowed, parseAllowedOrigins } from "./cors.js";

describe("CORS origin policy", () => {
  const configured = parseAllowedOrigins("https://lnfs.example.com, http://localhost:5173/");

  it("accepts configured origins and requests without an Origin header", () => {
    assert.equal(isOriginAllowed("https://lnfs.example.com", configured, "production"), true);
    assert.equal(isOriginAllowed("http://localhost:5173", configured, "production"), true);
    assert.equal(isOriginAllowed(undefined, configured, "production"), true);
  });

  it("accepts alternate local Vite ports only outside production", () => {
    assert.equal(isOriginAllowed("http://localhost:5174", configured, "development"), true);
    assert.equal(isOriginAllowed("http://127.0.0.1:4173", configured, "test"), true);
    assert.equal(isOriginAllowed("http://localhost:5174", configured, "production"), false);
  });

  it("rejects malformed and unrelated origins", () => {
    assert.equal(isOriginAllowed("not-an-origin", configured, "development"), false);
    assert.equal(isOriginAllowed("https://example.net", configured, "development"), false);
  });
});
