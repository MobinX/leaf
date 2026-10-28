import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import {
  base64ToBytes,
  bytesToBase64,
  compressUpdate,
  decodeDocFromD1,
  decompressUpdate,
  encodeDocForD1,
  splitChunks,
} from "./yjsDocStore";

describe("yjsDocStore", () => {
  test("compress/decompress round-trips bytes", async () => {
    const original = new TextEncoder().encode("hello leaf ".repeat(1000));
    const compressed = await compressUpdate(original);
    expect(compressed.length).toBeLessThan(original.length);
    const back = await decompressUpdate(compressed);
    expect(back).toEqual(original);
  });

  test("yjs doc survives D1 encode/decode with content and formatting", async () => {
    const doc = new Y.Doc();
    const xml = doc.getXmlFragment("default");
    // ProseMirror content is XML; images ride along as <img src="..."> attrs.
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("Lab report")]);
    const img = new Y.XmlElement("image");
    img.setAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    xml.push([p, img]);

    const b64 = await encodeDocForD1(doc);
    expect(typeof b64).toBe("string");

    const restored = new Y.Doc();
    Y.applyUpdate(restored, await decodeDocFromD1(b64));
    expect(restored.getXmlFragment("default").length).toBe(2);
    expect(restored.getXmlFragment("default").get(1).getAttribute("src")).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(restored.getXmlFragment("default").toString()).toBe(xml.toString());
  });

  test("base64 helpers round-trip and chunks reassemble", async () => {
    const original = new TextEncoder().encode("abc123".repeat(5000));
    const b64 = bytesToBase64(original);
    expect(base64ToBytes(b64)).toEqual(original);

    const chunks = splitChunks(original, 1000);
    expect(chunks.length).toBe(Math.ceil(original.length / 1000));
    const joined = new Uint8Array(original.length);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    expect(joined).toEqual(original);
  });
});
