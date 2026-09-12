import assert from "node:assert/strict";
import test from "node:test";
import { createHandoverPointSchema, updateHandoverPointSchema } from "./admin-catalog.validator.js";

const validPoint = {
  name: "Quầy CTSV Alpha",
  address: "Tầng 1, tòa Alpha",
  areaId: "11111111-1111-4111-8111-111111111111",
  buildingId: "22222222-2222-4222-8222-222222222222",
  mapPositionX: 48.25,
  mapPositionY: 62.5
};

test("handover point accepts complete marker coordinates within the campus map", () => {
  const parsed = createHandoverPointSchema.parse(validPoint);
  assert.equal(parsed.mapPositionX, 48.25);
  assert.equal(parsed.mapPositionY, 62.5);
});

test("handover point rejects incomplete or out-of-range marker coordinates", () => {
  assert.equal(createHandoverPointSchema.safeParse({ ...validPoint, mapPositionY: undefined }).success, false);
  assert.equal(createHandoverPointSchema.safeParse({ ...validPoint, mapPositionX: 101 }).success, false);
  assert.equal(updateHandoverPointSchema.safeParse({ mapPositionX: null, mapPositionY: 50 }).success, false);
});

test("handover point map URL only accepts safe web or application paths", () => {
  assert.equal(createHandoverPointSchema.safeParse({ ...validPoint, mapImageUrl: "https://cdn.example.com/campus.webp" }).success, true);
  assert.equal(createHandoverPointSchema.safeParse({ ...validPoint, mapImageUrl: "/campus-map.webp" }).success, true);
  assert.equal(createHandoverPointSchema.safeParse({ ...validPoint, mapImageUrl: "javascript:alert(1)" }).success, false);
});
