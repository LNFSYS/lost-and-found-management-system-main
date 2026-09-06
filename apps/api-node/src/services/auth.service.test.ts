import assert from "node:assert/strict";
import test from "node:test";
import type { AccessTokenPayload, User } from "../types/auth.js";
import { createAuthService, isAccessSessionValid } from "./auth.service.js";

const payload: AccessTokenPayload = {
  sub: "user-id",
  email: "user@example.com",
  roles: ["USER"],
  sessionVersion: 2
};

const activeUser: User & { sessionVersion: number } = {
  id: "user-id",
  email: "user@example.com",
  fullName: "User",
  studentCode: null,
  phoneNumber: null,
  avatar: { hasAvatar: false, updatedAt: null },
  status: "ACTIVE",
  roles: ["USER"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  sessionVersion: 2
};

test("access session accepts active user with matching session version", () => {
  assert.equal(isAccessSessionValid(activeUser, payload), true);
});

test("access session rejects disabled user even when token version still matches", () => {
  assert.equal(isAccessSessionValid({ ...activeUser, status: "DISABLED" }, payload), false);
});

test("access session rejects stale tokens after session version changes", () => {
  assert.equal(isAccessSessionValid({ ...activeUser, sessionVersion: 3 }, payload), false);
});

function avatarFile() {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  return { buffer, size: buffer.length, mimetype: "image/jpeg", originalname: "avatar.jpg" } as Express.Multer.File;
}

test("avatar upload stores Cloudinary metadata and cleans up the previous asset", async () => {
  const destroyed: string[] = [];
  const storage = {
    async upload() {
      return { publicId: "lnfs/avatars/new", assetId: "asset-new", version: 7, format: "jpg", resourceType: "image" as const, bytes: 4 };
    },
    async destroy(publicId: string) { destroyed.push(publicId); },
    async download() { return { body: Buffer.from("avatar"), contentType: "image/jpeg" }; }
  };
  const updates: unknown[] = [];
  const service = createAuthService({
    avatarStorage: storage,
    avatarRepository: {
      async findAvatarById() {
        return { publicId: "lnfs/avatars/old", assetId: "asset-old", version: 3, format: "jpg", resourceType: "image" as const, size: 4, updatedAt: null };
      },
      async updateAvatar(_userId, input) {
        updates.push(input);
        return activeUser;
      }
    }
  });

  await service.updateAvatar("user-id", avatarFile());
  assert.deepEqual(destroyed, ["lnfs/avatars/old"]);
  assert.deepEqual(updates[0], { publicId: "lnfs/avatars/new", assetId: "asset-new", version: 7, format: "jpg", resourceType: "image", size: 4 });
});

test("avatar upload cleans up a new Cloudinary asset when database update fails", async () => {
  const destroyed: string[] = [];
  const service = createAuthService({
    avatarStorage: {
      async upload() {
        return { publicId: "lnfs/avatars/orphan", assetId: null, version: 8, format: "jpg", resourceType: "image" as const, bytes: 4 };
      },
      async destroy(publicId: string) { destroyed.push(publicId); },
      async download() { return { body: Buffer.alloc(0), contentType: "image/jpeg" }; }
    },
    avatarRepository: {
      async findAvatarById() { return null; },
      async updateAvatar() { throw new Error("database unavailable"); }
    }
  });

  await assert.rejects(() => service.updateAvatar("user-id", avatarFile()), /database unavailable/);
  assert.deepEqual(destroyed, ["lnfs/avatars/orphan"]);
});
