/** Tillatte, passive bildeformater fra Nasjonalbibliotekets bildetjeneste. */
export const ALLOWED_NB_IMAGE_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function parseNbImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.nb.no" ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      !url.pathname.startsWith("/services/image/")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/**
 * Leser en web-stream til og med grensen, og avbryter upstream straks den brytes.
 * Dermed er en manglende eller falsk Content-Length ikke nok til å fylle minnet.
 */
export async function readImageLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  if (!body) return new ArrayBuffer(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel("image too large");
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
