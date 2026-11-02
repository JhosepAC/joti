/** ZIP STORE: no recompression of already compressed originals; UTF-8 paths, CRC32. */
export function archive(files: { name: string; bytes: Uint8Array }[]) {
  const entries: Uint8Array[] = [],
    directory: Uint8Array[] = [];
  let offset = 0,
    directorySize = 0;
  const crc = (bytes: Uint8Array) => {
    let n = 0xffffffff;
    for (const b of bytes) {
      n ^= b;
      for (let bit = 0; bit < 8; bit++)
        n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
    }
    return (n ^ 0xffffffff) >>> 0;
  };
  for (const [index, file] of files.entries()) {
    const name = new TextEncoder().encode(
        `${String(index + 1).padStart(3, "0")}-${file.name.replace(/[\\/\x00-\x1f]/g, "_")}`,
      ),
      checksum = crc(file.bytes);
    const local = new Uint8Array(30 + name.length),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint32(14, checksum, true);
    l.setUint32(18, file.bytes.length, true);
    l.setUint32(22, file.bytes.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length),
      c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, checksum, true);
    c.setUint32(20, file.bytes.length, true);
    c.setUint32(24, file.bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    entries.push(local, file.bytes);
    directory.push(central);
    offset += local.length + file.bytes.length;
    directorySize += central.length;
  }
  const end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  return new Blob([...entries, ...directory, end] as BlobPart[], {
    type: "application/zip",
  });
}
