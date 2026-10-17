import path from "node:path";

const artworkDirectory = path.join(
  process.cwd(),
  ".printhub-private",
  "artwork"
);

export function customerArtworkPath(storageKey: string) {
  if (!/^[0-9a-f-]+\.(jpg|pdf)$/.test(storageKey)) {
    throw new Error("INVALID_ARTWORK_STORAGE_KEY");
  }

  return path.join(artworkDirectory, storageKey);
}

export { artworkDirectory };
