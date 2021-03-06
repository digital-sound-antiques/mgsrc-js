function toHex(n: number, col = 2) {
  return ("0000" + n.toString(16)).slice(-col);
}

function _Uint16ToInt16(val: number): number {
  return val - 0x10000;
}

export function isCompressed(buf: ArrayBuffer) {
  const d = new Uint8Array(buf);
  const magic = String.fromCharCode(d[0], d[1], d[2]);
  let rp = 0;

  if (magic != "MGS") {
    throw new Error("Not a MGS object.");
  }

  while (rp < d.byteLength) {
    if (d[rp++] === 0) break;
  }

  if (rp === d.byteLength) {
    throw new Error("Not a MGS object.");
  }

  const settings = d[rp++];
  return settings & 0x80 ? true : false;
}

export function uncompress(buf: ArrayBuffer) {
  const inp = new Uint8Array(buf);
  const out = new Uint8Array(0x4000);
  let rp = 0;
  let wp = 0;

  const magic = String.fromCharCode(inp[0], inp[1], inp[2]);
  if (magic != "MGS") {
    throw new Error("Not a MGS object.");
  }

  while (rp < inp.byteLength) {
    if (inp[rp++] === 0) break;
  }

  if (rp === inp.byteLength) {
    throw new Error("Not a MGS object.");
  }

  const settings = inp[rp++];
  if ((settings & 0x80) === 0) {
    throw new Error("Not a compressed object.");
  }

  wp = rp;

  const dataSize = (inp[rp + 1] << 8) | inp[rp];
  // this function don't see data size. msgdrv use data size to stack
  // MGS data from the bottom of the memory page.
  rp += 2;

  for (let i = 0; i < rp; i++) {
    out[i] = inp[i];
  }
  out[3] = "3".charCodeAt(0); // fix MGSAxx -> MGS3xx
  out[rp - 3] &= 0x7f; // drop compressions flag.

  /* the compression format seems to be similar to LZEXE's method, also as known as [lze](http://gorry.haun.org/pw/?lze). */
  let _B = 1;
  let _C = 0;

  const readInfoBit = () => {
    const ret = _C & 0x80 ? 1 : 0;
    _C = (_C << 1) & 0xff;
    _B--;
    if (_B === 0) {
      _B = 8;
      _C = inp[rp++];
    }
    return ret;
  };

  readInfoBit(); // first fetch

  while (true) {
    if (readInfoBit()) {
      // 1
      out[wp++] = inp[rp++];
    } else {
      let size, offset;
      if (readInfoBit()) {
        // 01
        const ll = inp[rp++];
        const hh = inp[rp++];
        size = hh >> 5;
        if (size == 0) {
          size = inp[rp++];
          if (size === 0) break;
        }
        offset = _Uint16ToInt16((hh << 8) | ll | 0xe000);
      } else {
        // 00
        size = (readInfoBit() << 1) | readInfoBit();
        const ll = inp[rp++];
        const hh = 0xff;
        offset = _Uint16ToInt16((hh << 8) | ll);
      }
      for (let i = 0; i < size + 2; i++) {
        out[wp] = out[wp + offset];
        wp++;
      }
    }
  }

  return out.buffer.slice(out.byteOffset, out.byteOffset + wp);
}
