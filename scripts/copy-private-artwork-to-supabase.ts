import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { StorageApiError } from "@supabase/supabase-js";
import { artworkBucket, getSupabaseArtwork } from "../lib/supabase-artwork";

const storageDirectory = path.join(process.cwd(), "private-uploads", "artwork");
const contentTypes = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  glb: "model/gltf-binary",
} as const;
const uploadRequested = process.argv.includes("--upload");

async function main() {
  const entries = await readdir(storageDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());

  if (files.length !== entries.length) {
    throw new Error("The artwork directory contains a non-file entry.");
  }

  const invalidFile = files.find(
    (file) => !/^[0-9a-f-]{36}\.(jpg|png|webp|pdf|glb)$/.test(file.name)
  );
  if (invalidFile) {
    throw new Error(`Invalid private artwork filename: ${invalidFile.name}`);
  }

  if (!uploadRequested) {
    console.log(
      `Dry run: ${files.length} private artwork file(s) would be copied to bucket "${artworkBucket}".`
    );
    for (const file of files) console.log(file.name);
    console.log("Add --upload to copy files. Local files and database records are never changed.");
    return;
  }

  const storage = getSupabaseArtwork().storage.from(artworkBucket);
  let uploaded = 0;
  let alreadyPresent = 0;

  for (const file of files) {
    const extension = file.name.slice(file.name.lastIndexOf(".") + 1);
    if (!(extension in contentTypes)) {
      throw new Error(`Unsupported private artwork extension: ${file.name}`);
    }

    const bytes = await readFile(path.join(storageDirectory, file.name));
    const { error } = await storage.upload(file.name, bytes, {
      contentType: contentTypes[extension as keyof typeof contentTypes],
      upsert: false,
    });

    if (error instanceof StorageApiError && error.statusCode === "409") {
      alreadyPresent += 1;
      console.log(`Already present: ${file.name}`);
      continue;
    }

    if (error) {
      throw new Error(`Unable to copy private artwork file ${file.name}.`, {
        cause: error,
      });
    }

    uploaded += 1;
    console.log(`Copied: ${file.name}`);
  }

  console.log(`Copy complete: ${uploaded} uploaded, ${alreadyPresent} already present.`);
}

main().catch((error: unknown) => {
  console.error("Private artwork copy failed:", error);
  process.exitCode = 1;
});
