type DownloadSummary = { fileName: string } | null;

export function getCustomPrintArtworkDownloads(value: unknown): {
  original: DownloadSummary;
  model: DownloadSummary;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { original: null, model: null };
  }
  const downloads = (value as Record<string, unknown>).downloads;
  if (!downloads || typeof downloads !== "object" || Array.isArray(downloads)) {
    return { original: null, model: null };
  }

  function getDownload(file: unknown): DownloadSummary {
    if (!file || typeof file !== "object" || Array.isArray(file)) return null;
    const fileName = (file as Record<string, unknown>).fileName;
    return typeof fileName === "string" && fileName
      ? { fileName }
      : null;
  }

  const files = downloads as Record<string, unknown>;
  return {
    original: getDownload(files.original),
    model: getDownload(files.model),
  };
}
