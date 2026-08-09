import { describe, expect, it } from "vitest";
import { ALLOWED_NB_IMAGE_TYPES, parseNbImageUrl, readImageLimited } from "../lib/nb-image";

describe("Nasjonalbibliotekets bildeproxy", () => {
  it("godtar bare den eksakte HTTPS-tjenesten uten alternativ port", () => {
    expect(parseNbImageUrl("https://www.nb.no/services/image/resolver/URN:NBN:no-nb_x"))
      .not.toBeNull();
    expect(parseNbImageUrl("https://www.nb.no.evil.test/services/image/x")).toBeNull();
    expect(parseNbImageUrl("https://www.nb.no:444/services/image/x")).toBeNull();
    expect(parseNbImageUrl("http://www.nb.no/services/image/x")).toBeNull();
    expect(parseNbImageUrl("https://user:pass@www.nb.no/services/image/x")).toBeNull();
  });

  it("tillater passive rastertyper, men ikke SVG", () => {
    expect(ALLOWED_NB_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_NB_IMAGE_TYPES.has("image/webp")).toBe(true);
    expect(ALLOWED_NB_IMAGE_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("leser et bilde innenfor bytegrensen", async () => {
    const body = new Blob([new Uint8Array([1, 2]), new Uint8Array([3])]).stream();
    const result = await readImageLimited(body, 3);
    expect(result).not.toBeNull();
    expect([...new Uint8Array(result!)]).toEqual([1, 2, 3]);
  });

  it("avbryter en stream straks bytegrensen brytes", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
      },
      cancel() {
        cancelled = true;
      },
    });

    expect(await readImageLimited(body, 5)).toBeNull();
    expect(cancelled).toBe(true);
  });
});
