// Browser polyfill for Node's `crypto` module (Web Crypto API).
import { Buffer } from "buffer";

export function randomBytes(size) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}
