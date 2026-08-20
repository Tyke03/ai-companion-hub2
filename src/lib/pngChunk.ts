/**
 * PNG tEXt chunk writer/reader for character card embedding.
 * Supports both V2 ("chara") and V3 ("ccv3") chunk names.
 */

function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToUtf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function createTextChunk(keyword: string, text: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(keyword);
  const nullByte = new Uint8Array([0]);
  const textBytes = new TextEncoder().encode(text);

  const chunkData = new Uint8Array(keyBytes.length + 1 + textBytes.length);
  chunkData.set(keyBytes, 0);
  chunkData.set(nullByte, keyBytes.length);
  chunkData.set(textBytes, keyBytes.length + 1);

  const typeBytes = new TextEncoder().encode("tEXt");
  const crcInput = new Uint8Array(4 + chunkData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(chunkData, 4);
  const crc = crc32(crcInput);

  // length (4) + type (4) + data + crc (4)
  const chunk = new Uint8Array(12 + chunkData.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, chunkData.length);
  chunk.set(typeBytes, 4);
  chunk.set(chunkData, 8);
  view.setUint32(8 + chunkData.length, crc);

  return chunk;
}

function findIendOffset(bytes: Uint8Array): number {
  // IEND chunk: length(4) + "IEND"(4) + crc(4) = 12 bytes at end
  // Search for IEND type
  for (let i = 8; i < bytes.length - 4; i++) {
    if (
      bytes[i] === 0x49 && // I
      bytes[i + 1] === 0x45 && // E
      bytes[i + 2] === 0x4e && // N
      bytes[i + 3] === 0x44    // D
    ) {
      return i - 4; // start of IEND chunk (length field)
    }
  }
  return -1;
}

export async function embedCardInPng(
  pngFile: File | Blob,
  cardJson: object,
  chunkName: "chara" | "ccv3" = "ccv3"
): Promise<Blob> {
  const arrayBuffer = await pngFile.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const jsonStr = JSON.stringify(cardJson);
  // Character-card PNG metadata stores UTF-8 JSON as base64, not a URI-encoded string.
  const base64 = utf8ToBase64(jsonStr);

  const textChunk = createTextChunk(chunkName, base64);
  const iendOffset = findIendOffset(bytes);

  if (iendOffset === -1) {
    throw new Error("Invalid PNG: IEND chunk not found");
  }

  const before = bytes.slice(0, iendOffset);
  const after = bytes.slice(iendOffset);
  const result = new Uint8Array(before.length + textChunk.length + after.length);
  result.set(before, 0);
  result.set(textChunk, before.length);
  result.set(after, before.length + textChunk.length);

  return new Blob([result], { type: "image/png" });
}

export type CardMetadata = Record<string, unknown>;

export function extractCardFromPng(bytes: Uint8Array): { chunkName: "ccv3" | "chara"; data: CardMetadata } | null {
  // Search for tEXt chunks with "ccv3" or "chara" keyword
  for (let i = 8; i < bytes.length - 12; i++) {
    if (
      bytes[i + 4] === 0x74 && // t
      bytes[i + 5] === 0x45 && // E
      bytes[i + 6] === 0x58 && // X
      bytes[i + 7] === 0x74    // t
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + i);
      const length = view.getUint32(0);
      const chunkData = bytes.slice(i + 8, i + 8 + length);

      // Find null separator between keyword and text
      const nullIdx = chunkData.indexOf(0);
      if (nullIdx === -1) continue;

      const keyword = new TextDecoder().decode(chunkData.slice(0, nullIdx));
      if (keyword !== "ccv3" && keyword !== "chara") continue;

      const textData = new TextDecoder().decode(chunkData.slice(nullIdx + 1));
      try {
        const json: unknown = JSON.parse(base64ToUtf8(textData));
        if (!json || typeof json !== "object" || Array.isArray(json)) continue;
        return { chunkName: keyword as "ccv3" | "chara", data: json as CardMetadata };
      } catch {
        continue;
      }
    }
  }
  return null;
}
