import * as Y from "yjs";

/** Gzip a Yjs update for D1 storage. Uses Web Compression Streams (browser + Workers). */
export async function compressUpdate(update: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  // Attach the reader BEFORE writing: with no reader attached, backpressure
  // can leave write()/close() pending forever and the save hangs at Saving…
  const result = new Response(stream.readable).arrayBuffer();
  // .slice() guarantees plain ArrayBuffer backing for the writer's types.
  await writer.write(update.slice());
  await writer.close();
  return new Uint8Array(await result);
}

/** Gunzip bytes loaded from D1 back into a Yjs update. */
export async function decompressUpdate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  // Reader first — see compressUpdate.
  const result = new Response(stream.readable).arrayBuffer();
  await writer.write(data.slice());
  await writer.close();
  return new Uint8Array(await result);
}

const B64_CHUNK = 0x8000;

/** Base64-encode bytes without blowing the call stack on large docs. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK));
  }
  return btoa(binary);
}

/** Base64-decode back to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Full Yjs state of a doc, compressed and ready for the D1 save endpoint. */
export async function encodeDocForD1(ydoc: Y.Doc): Promise<string> {
  const update = Y.encodeStateAsUpdate(ydoc);
  const compressed = await compressUpdate(update);
  return bytesToBase64(compressed);
}

/** Reverse of `encodeDocForD1`: returns the raw Yjs update to `Y.applyUpdate`. */
export async function decodeDocFromD1(b64: string): Promise<Uint8Array> {
  return decompressUpdate(base64ToBytes(b64));
}

/** Split bytes into D1-safe pieces (rows cap at 2MB; stay well under it). */
export function splitChunks(data: Uint8Array, chunkSize = 1_500_000): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [new Uint8Array(0)];
}
