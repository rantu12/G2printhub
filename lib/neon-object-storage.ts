import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const neonUploadsBucket = "printhub-uploads";
export const maxNeonModelSize = 20 * 1024 * 1024;
const modelContentType = "model/gltf-binary";
const modelObjectKeyPattern =
  /^models\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.glb$/;

let client: S3Client | undefined;

export function isNeonModelObjectKey(value: unknown): boolean {
  return typeof value === "string" && modelObjectKeyPattern.test(value);
}

function getNeonS3Client() {
  if (client) return client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const endpointValue = process.env.AWS_ENDPOINT_URL_S3?.trim();
  const region = process.env.AWS_REGION?.trim();

  if (!accessKeyId || !secretAccessKey || !endpointValue || !region) {
    throw new Error("NEON_OBJECT_STORAGE_ENV_MISSING");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("NEON_OBJECT_STORAGE_CONFIG_INVALID");
  }

  if (
    endpoint.protocol !== "https:" ||
    !endpoint.hostname.endsWith(".neon.tech") ||
    endpoint.username ||
    endpoint.password
  ) {
    throw new Error("NEON_OBJECT_STORAGE_CONFIG_INVALID");
  }

  client = new S3Client({
    region,
    endpoint: endpoint.toString(),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });

  return client;
}

export async function createNeonModelUpload(fileSize: number) {
  if (
    !Number.isInteger(fileSize) ||
    fileSize < 12 ||
    fileSize > maxNeonModelSize
  ) {
    throw new Error("INVALID_NEON_MODEL_SIZE");
  }

  const s3 = getNeonS3Client();
  const key = `models/${randomUUID()}.glb`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: neonUploadsBucket,
      Key: key,
      ContentType: modelContentType,
    }),
    { expiresIn: 300 }
  );
  const previewUrl = await createNeonModelPreviewUrl(key);

  return { key, uploadUrl, previewUrl };
}

export async function createNeonModelPreviewUrl(key: string) {
  if (!isNeonModelObjectKey(key)) {
    throw new Error("INVALID_NEON_MODEL_OBJECT_KEY");
  }

  return getSignedUrl(
    getNeonS3Client(),
    new GetObjectCommand({ Bucket: neonUploadsBucket, Key: key }),
    { expiresIn: 3600 }
  );
}

export async function getModelPreviewUrl(modelUrl: string) {
  return isNeonModelObjectKey(modelUrl)
    ? createNeonModelPreviewUrl(modelUrl)
    : modelUrl;
}

export async function verifyNeonModelObject(key: string, expectedSize?: number) {
  if (!isNeonModelObjectKey(key)) {
    throw new Error("INVALID_NEON_MODEL_OBJECT_KEY");
  }

  const s3 = getNeonS3Client();
  const metadata = await s3.send(
    new HeadObjectCommand({ Bucket: neonUploadsBucket, Key: key })
  );
  const fileSize = metadata.ContentLength;

  if (
    typeof fileSize !== "number" ||
    fileSize < 12 ||
    fileSize > maxNeonModelSize ||
    (expectedSize !== undefined && fileSize !== expectedSize) ||
    metadata.ContentType !== modelContentType
  ) {
    throw new Error("INVALID_NEON_MODEL_FILE");
  }

  const headerResponse = await s3.send(
    new GetObjectCommand({
      Bucket: neonUploadsBucket,
      Key: key,
      Range: "bytes=0-11",
    })
  );
  const header = await headerResponse.Body?.transformToByteArray();

  if (!header || header.byteLength !== 12) {
    throw new Error("INVALID_NEON_MODEL_FILE");
  }

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const hasValidHeader =
    header[0] === 0x67 &&
    header[1] === 0x6c &&
    header[2] === 0x54 &&
    header[3] === 0x46 &&
    view.getUint32(4, true) === 2 &&
    view.getUint32(8, true) === fileSize;

  if (!hasValidHeader) {
    throw new Error("INVALID_NEON_MODEL_FILE");
  }
}
