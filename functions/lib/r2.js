import { HttpError } from "./http.js";

export function requireFilesBucket(env) {
  if (!env.FILES_BUCKET) {
    throw new HttpError(500, "FILES_BUCKET binding is missing", undefined, true);
  }

  return env.FILES_BUCKET;
}

export async function putPrivateFile(bucket, key, file, mimeType) {
  await bucket.put(key, file, {
    httpMetadata: {
      contentType: mimeType
    }
  });
}

export async function cleanupPrivateFile(bucket, key) {
  try {
    await bucket.delete(key);
  } catch {
    // Preserve the original D1 or concurrency error and never report cleanup as success.
  }
}

export async function deletePrivateFiles(bucket, keys) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];

  if (uniqueKeys.length) {
    await bucket.delete(uniqueKeys);
  }
}
