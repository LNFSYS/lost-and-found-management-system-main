import assert from "node:assert/strict";
import test from "node:test";
import { defaultMatchingConfig, type MatchingConfig } from "../domain/matching.engine.js";
import { sanitizeMatchingConfig } from "./matching.use-cases.js";

function config(overrides: Partial<MatchingConfig> = {}): MatchingConfig {
  return {
    ...defaultMatchingConfig,
    ...overrides,
    weights: { ...defaultMatchingConfig.weights, ...overrides.weights }
  };
}

test("matching config preserves valid ordered thresholds and weights", () => {
  const input = config({
    weakThreshold: 0.4,
    suggestionThreshold: 0.58,
    notificationThreshold: 0.72,
    highConfidenceThreshold: 0.9,
    weights: { text: 0.35, category: 0.2, location: 0.15, time: 0.1, image: 0.1, ocr: 0.1 }
  });

  assert.deepEqual(sanitizeMatchingConfig(input), input);
});

test("matching config falls back when thresholds are out of order or out of range", () => {
  const sanitized = sanitizeMatchingConfig(config({
    weakThreshold: 0.8,
    suggestionThreshold: 0.6,
    highConfidenceThreshold: 1.2
  }));

  assert.equal(sanitized.weakThreshold, defaultMatchingConfig.weakThreshold);
  assert.equal(sanitized.suggestionThreshold, defaultMatchingConfig.suggestionThreshold);
  assert.equal(sanitized.notificationThreshold, defaultMatchingConfig.notificationThreshold);
  assert.equal(sanitized.highConfidenceThreshold, defaultMatchingConfig.highConfidenceThreshold);
});

test("matching config falls back when all weights are unusable", () => {
  const sanitized = sanitizeMatchingConfig(config({
    weights: { text: 0, category: 0, location: 0, time: 0, image: 0, ocr: 0 }
  }));

  assert.deepEqual(sanitized.weights, defaultMatchingConfig.weights);
});
