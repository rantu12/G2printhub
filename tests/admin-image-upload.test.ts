import assert from "node:assert/strict";
import test from "node:test";
import { saveAdminImage } from "../lib/admin-image-upload";

test("admin image upload reports missing Blob configuration without calling storage", async () => {
  const previous = {
    token: process.env.BLOB_READ_WRITE_TOKEN,
    storeId: process.env.BLOB_STORE_ID,
    oidcToken: process.env.VERCEL_OIDC_TOKEN,
    vercel: process.env.VERCEL,
  };

  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.VERCEL;

  try {
    const image = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "image.png",
      { type: "image/png" }
    );
    const result = await saveAdminImage(image, "custom-print");

    assert.deepEqual(result, {
      success: false,
      status: 503,
      message:
        "Image storage is not configured. Set up Vercel Blob for this environment.",
    });
  } finally {
    if (previous.token === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous.token;
    if (previous.storeId === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = previous.storeId;
    if (previous.oidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previous.oidcToken;
    if (previous.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous.vercel;
  }
});
