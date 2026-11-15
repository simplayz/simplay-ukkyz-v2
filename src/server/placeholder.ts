import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

export function placeholderPng(z: number, x: number, y: number): Buffer {
  const size = 256;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py += 1) {
    const row = py * (size * 4 + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px += 1) {
      const index = row + 1 + px * 4;
      const grid = px % 64 === 0 || py % 64 === 0;
      const diagonal = Math.abs(px - py) < 2 || Math.abs(px + py - 255) < 2;
      const noise = ((px * 17 + py * 31 + z * 13 + x * 7 + y * 11) % 23) / 23;
      raw[index] = grid ? 70 : diagonal ? 91 : 22 + Math.round(noise * 8);
      raw[index + 1] = grid ? 91 : diagonal ? 104 : 34 + Math.round(noise * 9);
      raw[index + 2] = grid ? 98 : diagonal ? 112 : 39 + Math.round(noise * 10);
      raw[index + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const text = Buffer.from(`Description\0Simplayz offline tile ${z}/${x}/${y}; upstream unavailable`, "latin1");
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("tEXt", text),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
