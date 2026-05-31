// Minimal ambient declarations for untyped JS dependencies.
declare module 'text-encoding' {
  export class TextEncoder {
    encode(input?: string): Uint8Array;
  }
  export class TextDecoder {
    decode(input?: ArrayBufferView | ArrayBuffer): string;
  }
}
