import {
  SccPatch,
  OpllPatch,
  StepEnvelope,
  ADSREnvelope,
  VoiceData,
  MGSObject,
  TrackCommand,
  TrackData,
  TextResource,
  OpllPatchMap
} from "./types";
import { uncompress } from "./uncompress";

const notes = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b", "r", "r", "r", "r"];

function c2l(n: number): string {
  if (n === 0) {
    return "%256";
  }
  if (2 < n) {
    if (192 % n === 0) {
      return `${192 / n}`;
    }
    if ((192 + 96) % n === 0) {
      return `${(192 + 96) / n}.`;
    }
    if ((192 + 96 + 48) % n === 0) {
      return `${(192 + 96 + 48) / n}..`;
    }
  }
  return "%" + n;
}

function getRhythmNote(flag: number): string {
  if (flag === 0x00) return "r";
  const r = [];
  if (flag & 0x10) r.push("b");
  if (flag & 0x8) r.push("s");
  if (flag & 0x4) r.push("m");
  if (flag & 0x2) r.push("c");
  if (flag & 0x1) r.push("h");
  return r.join("");
}

export function parseStepEnvelope(data: ArrayBuffer): Array<{ mml: string }> {
  const v = new DataView(data);
  const res = new Array<any>();
  let idx = 0;
  while (idx < v.byteLength) {
    const cmd = v.getUint8(idx++);
    if (cmd < 16) {
      res.push({ mml: cmd.toString(16) });
    } else if (cmd === 0x10) {
      const n = v.getUint8(idx++);
      res.push({ mml: `@${n}.` });
    } else if (cmd === 0x11) {
      const n1 = v.getUint8(idx++);
      const n2 = v.getUint8(idx++);
      res.push({ mml: `y${n1},${n2}.` });
    } else if (cmd === 0x12) {
      const n = v.getInt8(idx++);
      res.push({ mml: `\\${n}.` });
    } else if (0x20 <= cmd && cmd <= 0x2f) {
      const n = v.getUint8(idx++);
      res.push({ mml: `${(cmd & 0xf).toString(16)}=${n}.` });
    } else if (cmd === 0x40) {
      res.push({ mml: "[" });
    } else if (cmd === 0x60) {
      res.push({ mml: `]` });
    } else if (0x80 <= cmd && cmd <= 0x9f) {
      res.push({ mml: `n${cmd & 0x1f}.` });
    } else if (0xa0 <= cmd && cmd <= 0xaf) {
      res.push({ mml: `/${cmd & 0x3}.` });
    } else if (0xe0 <= cmd && cmd <= 0xef) {
      const n = v.getUint8(idx++);
      res.push({ mml: `${(cmd & 0xf).toString(16)}:${n}.` });
    } else {
      throw new Error("Unknown Envelope Command: 0x" + cmd.toString(16));
    }
  }
  return res;
}

function decodeMGSText(msg: Array<number>): string {
  const seq = Array<number>();
  let i = 0;
  while (i < msg.length) {
    const ch = msg[i++];
    if (ch < 0x20 || 0x80 === ch || (0xf0 <= ch && ch <= 0xff)) {
      const s = "\\x" + ("0" + ch.toString(16)).slice(-2);
      seq.push(s.charCodeAt(0));
      seq.push(s.charCodeAt(1));
      seq.push(s.charCodeAt(2));
      seq.push(s.charCodeAt(3));
    } else if (0x81 <= ch && ch <= 0x9f) {
      // SJIS 2-byte character
      seq.push(ch);
      seq.push(msg[i++]);
    } else if (0xe0 <= ch && ch <= 0xef) {
      // SJIS 2-byte character
      seq.push(ch);
      seq.push(msg[i++]);
    } else if (ch === 34 || ch === 92) {
      // double quote or backslash
      seq.push(92);
      seq.push(ch);
    } else {
      // Other characters
      seq.push(ch);
    }
  }
  return new TextDecoder('ms932').decode(new Uint8Array(seq));
}

export function parseVoiceTrack(data: ArrayBuffer): VoiceData {
  let idx = 0;
  const opllPatches = Array<OpllPatch>();
  const sccPatches = Array<SccPatch>();
  const envelopes = Array<StepEnvelope | ADSREnvelope>();
  const opllPatchMaps = Array<OpllPatchMap>();
  const texts = Array<TextResource>();
  const v = new DataView(data);
  let psgTunes: Array<number> | null = null;
  let opllTunes: Array<number> | null = null;

  while (idx < v.byteLength) {
    const cmd = v.getUint8(idx++);
    if (cmd === 0x00) {
      const number = v.getUint8(idx++);
      const patch = [];
      for (let i = 0; i < 8; i++) {
        patch.push(v.getUint8(idx++));
      }
      opllPatches.push({ number: number & 0x1f, data: patch });
    } else if (cmd === 0x01) {
      const from = v.getUint8(idx++);
      const to = v.getUint8(idx++);
      opllPatchMaps.push({ from, to });
    } else if (cmd === 0x02) {
      const number = v.getUint8(idx++) & 0x1f;
      const m = v.getUint8(idx++);
      const mode = (m & 0x7f) >> 5;
      const nfreq = m & 0x1f;
      if (m < 0x80) {
        const len = v.getUint8(idx++);
        const binary = v.buffer.slice(v.byteOffset + idx, v.byteOffset + idx + len);
        envelopes.push({ type: "@e", number, mode, nfreq, commands: parseStepEnvelope(binary) });
        idx += len;
      } else {
        const al = v.getUint8(idx++);
        const ar = v.getUint8(idx++);
        const dr = v.getUint8(idx++);
        const sl = v.getUint8(idx++);
        const sr = v.getUint8(idx++);
        const rr = v.getUint8(idx++);
        envelopes.push({ type: "@r", number, mode, nfreq, al, ar, dr, sl, sr, rr });
      }
    } else if (cmd === 0x03) {
      const number = v.getUint8(idx++) & 0x1f;
      const patch = [];
      for (let i = 0; i < 32; i++) {
        patch.push(v.getUint8(idx++));
      }
      sccPatches.push({ number, data: patch });
    } else if (cmd === 0x04) {
      psgTunes = [];
      for (let i = 0; i < 12; i++) {
        psgTunes.push(v.getUint16(idx, true));
        idx += 2;
      }
    } else if (cmd === 0x05) {
      opllTunes = [];
      for (let i = 0; i < 12; i++) {
        opllTunes.push(v.getUint16(idx, true));
        idx += 2;
      }
    } else if (cmd === 0x06) {
      const number = v.getUint8(idx++);
      const buf = [];
      while (true) {
        const c = v.getUint8(idx++);
        if (c === 0) break;
        buf.push(c);
      }
      texts.push({ number, text: decodeMGSText(buf) });
    } else if (cmd === 0xff) {
      break;
    } else {
      throw new Error("Unknown voice track command: 0x" + cmd.toString(16));
    }
  }
  return {
    byteLength: idx,
    opllPatches,
    opllPatchMaps,
    envelopes,
    texts,
    sccPatches,
    psgTunes,
    opllTunes
  };
}

function parseTrack(data: ArrayBuffer, track: number, rhythm: boolean): TrackData {
  const res = new Array<TrackCommand>();
  const v = new DataView(data);
  let idx = 0;
  const lvalue = 48;
  let additionalLength = 0;
  let jumpMarkerCount = 0;
  let oct = 3;

  const readCounts = () => {
    let n = v.getUint8(idx++);
    const res: [number] = [n];
    while (n == 255) {
      n = v.getUint8(idx++);
      res.push(n);
    }
    return res;
  };

  while (idx < v.byteLength) {
    let cmd = v.getUint8(idx++);
    const _wrt = (obj: { mml: string; count?: number; loop?: number }) => res.push({ cmd, ...obj });
    if (rhythm && cmd <= 0x1f) {
      // mgsdrv 3.00 command
      const counts = readCounts();
      const flag = cmd & 0x1f;
      const n = counts[0];
      _wrt({ mml: getRhythmNote(flag) + c2l(n), count: n });
      for (let i = 1; i < counts.length; i++) {
        const n = counts[i];
        _wrt({ mml: "r" + c2l(n), count: n });
        additionalLength += 2;
      }
    } else if (rhythm && cmd <= 0x3f) {
      const n = v.getUint8(idx++);
      const flag = cmd & 0x1f;
      _wrt({ mml: getRhythmNote(flag) + c2l(n), count: n });
    } else if (rhythm && (cmd & 0xe0) === 0xa0) {
      const flag = cmd & 0x1f;
      _wrt({ mml: getRhythmNote(flag) + ":", count: lvalue });
    } else if (cmd <= 0x0c) {
      // mgsdrv 3.00 command
      const counts = readCounts();
      for (let i = 0; i < counts.length; i++) {
        const n = counts[i];
        _wrt({ mml: `${notes[cmd & 0xf]}${c2l(n)}`, count: n });
        if (i != counts.length - 1) {
          additionalLength += 3;
          _wrt({ mml: "&" });
        }
      }
    } else if (0x10 <= cmd && cmd <= 0x1c) {
      // mgsdrv 3.00 command.
      _wrt({ mml: notes[cmd & 0xf], count: lvalue });
    } else if (0x20 <= cmd && cmd <= 0x2f) {
      const n = v.getUint8(idx++);
      _wrt({ mml: `${notes[cmd & 0xf]}${c2l(n)}`, count: n });
    } else if (0x30 <= cmd && cmd <= 0x3f) {
      _wrt({ mml: notes[cmd & 0xf], count: lvalue });
    } else if (cmd === 0x40) {
      _wrt({ mml: "&" });
    } else if (cmd === 0x41) {
      const value = v.getUint16(idx, true);
      idx += 2;
      idx += 48;
      _wrt({ mml: "t" + value });
    } else if (cmd === 0x42) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "l" + c2l(n) });
    } else if (cmd === 0x43) {
      // mgsdrv 3.00 command.
      const n = v.getUint16(idx, true);
      idx += 2;
      _wrt({ mml: "l" + c2l(n) });
    } else if (cmd === 0x44) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "q" + n });
    } else if (cmd === 0x45) {
      const n = v.getUint8(idx++);
      const r = n >> 5;
      _wrt({ mml: ["vb", "vs", "vm", "vc", "vh"][r] + (n & 0xf) });
    } else if (cmd === 0x47) {
      const n = v.getUint8(idx++);
      const r = n >> 5;
      _wrt({ mml: ["vb", "vs", "vm", "vc", "vh"][r] + (n & 0x10 ? "-" + (0x10 - (n & 0xf)) : "+" + (n & 0xf)) });
    } else if (cmd === 0x46) {
      const voff = v.getInt8(idx++);
      _wrt({ mml: voff >= 0 ? `v+${voff}` : `v${voff}` });
    } else if (cmd === 0x48) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "k" + n });
    } else if (cmd === 0x49) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "@e" + n });
    } else if (cmd === 0x4a) {
      _wrt({ mml: "/" });
    } else if (cmd === 0x4b) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "s" + n });
    } else if (cmd === 0x4c) {
      const n = v.getUint16(idx, true);
      idx += 2;
      _wrt({ mml: "m" + n });
    } else if (cmd === 0x4d) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "n" + n });
    } else if (cmd === 0x4e) {
      oct = Math.min(7, oct + 1);
      _wrt({ mml: ">" });
    } else if (cmd === 0x4f) {
      oct = Math.max(0, oct - 1);
      _wrt({ mml: "<" });
    } else if (cmd === 0x50) {
      const n = v.getInt8(idx++);
      _wrt({ mml: "\\" + (track < 9 ? -1 : 1) * n });
    } else if (cmd === 0x51) {
      const n = v.getInt16(idx, true);
      idx += 2;
      _wrt({ mml: "@\\" + n });
    } else if (cmd === 0x52) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "p" + n });
    } else if (cmd === 0x53) {
      const key = v.getUint8(idx++);
      _wrt({ mml: `${notes[key]}_` });

      // Workaround for MGSDRV bug: absolute octave `o` command is treated as +1 before next note.
      while (true) {
        const nxt = v.getUint8(idx);
        if (0xd0 <= nxt && nxt <= 0xdf) {
          cmd = v.getUint8(idx++);
          oct = (cmd & 0x7) + 1;
          _wrt({ mml: "o" + Math.max(1, (oct - 1)) });
          continue;
        } else if (nxt === 0x4e) {
          cmd = v.getUint8(idx++);
          oct = Math.min(7, oct + 1);
          _wrt({ mml: ">" });
          continue;
        }
        if (nxt === 0x4f) {
          cmd = v.getUint8(idx++);
          oct = Math.max(0, oct - 1);
          _wrt({ mml: "<" });
          continue;
        }
        break;
      }

    } else if (cmd === 0x54) {
      const n1 = v.getUint8(idx++);
      const n2 = v.getUint8(idx++);
      const n3 = v.getUint8(idx++);
      const n4 = v.getInt8(idx++);
      _wrt({ mml: `h${n1 - 1},${n2},${n3 - 1},${track < 9 ? -n4 : n4}` });
    } else if (cmd === 0x55) {
      const n = v.getInt16(idx, true);
      idx += 2;
      _wrt({ mml: "@p" + n });
    } else if (cmd === 0x57) {
      const n = v.getUint8(idx++);
      // const n2 = v.getUint16(idx);
      idx += 2;
      _wrt({ mml: "[" + n, loop: n });
    } else if (cmd === 0x58) {
      // const ptr = v.getUint16(idx, true);
      idx += 2;
      _wrt({ mml: "|" });
    } else if (cmd === 0x59) {
      idx += 1;
      // const ptr = v.getUint16(idx, true);
      idx += 2;
      _wrt({ mml: "]" });
    } else if (cmd === 0x5a) {
      const n = v.getUint8(idx++);
      if (rhythm) {
        _wrt({ mml: 0 < n ? "kf" : "ko" });
      } else {
        _wrt({ mml: 0 < n ? "ho" : "hf" });
      }
    } else if (cmd === 0x5b) {
      const n = v.getUint8(idx++);
      _wrt({ mml: 0 < n ? "so" : "sf" });
    } else if (cmd === 0x5c) {
      const n1 = v.getUint8(idx++);
      const n2 = v.getUint8(idx++);
      _wrt({ mml: `y${n1},${n2}` });
    } else if (cmd === 0x5d) {
      _wrt({ mml: "$" });
      jumpMarkerCount++;
    } else if (cmd === 0x5f) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "@\\" + n });
    } else if (cmd === 0x60) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "@m" + n });
    } else if (cmd === 0x61) {
      const n = v.getUint8(idx++);
      _wrt({ mml: "@o" + n });
    } else if (cmd === 0x63) {
      _wrt({ mml: "@f" });
    } else if (cmd === 0x64) {
      _wrt({ mml: "hi" });
    } else if (0x80 <= cmd && cmd <= 0x9f) {
      _wrt({ mml: "@" + (cmd & 0x1f) });
    } else if (0xc0 <= cmd && cmd <= 0xcf) {
      _wrt({ mml: "v" + (cmd & 0xf) });
    } else if (0xd0 <= cmd && cmd <= 0xdf) {
      oct = (cmd & 0x7);
      _wrt({ mml: "o" + (oct + 1) });
    } else if (0xe0 <= cmd && cmd <= 0xef) {
      _wrt({ mml: "/" + (cmd & 0x3) });
    } else if (cmd === 0xff) {
      break;
    } else {
      console.error(`Unknown command: 0x${("0" + cmd.toString(16)).slice(-2)} at offset ${idx} of track ${track}`);
    }
  }
  return {
    track,
    byteLength: idx,
    commands: res,
    additionalLength,
    jumpMarkerCount
  };
}

export function parseMGSTitle(buf: ArrayBuffer) {
  const titleArray = [];
  const d = new DataView(buf);
  for (let i = 8; i < d.byteLength - 1; i++) {
    const c = d.getUint8(i);
    if (c === 0x1a) {
      return new TextDecoder('ms932').decode(new Uint8Array(titleArray));
    }
    titleArray.push(c);
  }
  throw new Error("MGS data is corrupted. No EOF marker found after the title section.");
}

export function parseMGSHeader(
  buf: ArrayBuffer
): { 
  binaryHeaderOffset: number; // Binary header start offset
  magic: string; 
  version: string; 
  settings: number; 
  isCompressed: boolean;
} {
  const d = new Uint8Array(buf);
  const magic = String.fromCharCode(d[0], d[1], d[2]);
  let rp = 0;

  if (magic != "MGS") {
    throw new Error("Not a MGS object.");
  }

  const version = String.fromCharCode(d[3], d[4], d[5]);

  while (rp < d.byteLength) {
    if (d[rp++] === 0) break;
  }

  if (rp === d.byteLength) {
    throw new Error("Not a MGS object.");
  }

  const binaryHeaderOffset = rp - 1;

  const settings = d[rp++];
  const isCompressed = settings & 0x80 ? true : false;

  return {
    binaryHeaderOffset,
    magic,
    version,
    settings,
    isCompressed
  };
}

export function parseMGS(mgs: ArrayBuffer): MGSObject {
  const { isCompressed } = parseMGSHeader(mgs);
  const buf = isCompressed ? uncompress(mgs) : mgs;
  const { version, binaryHeaderOffset } = parseMGSHeader(buf);

  if (!/^[0-9]+$/.test(version)) {
    throw new Error(`Unspported format version: MGS${version}.`);
  }

  const versionCode = parseInt(version);
  if (versionCode < 300) {
    throw new Error(`Unsupported format version: MGS${version}. MGS310 or greater version is required.`);
  }

  const title = parseMGSTitle(buf);
  const d = new DataView(buf);

  let offset = binaryHeaderOffset;
  const root = offset;

  d.getUint8(offset++); // skip first byte
  const flags = d.getUint8(offset++);
  const settings = {
    isCompressed,
    opllMode: flags & 1,
    lfoMode: (flags >> 1) & 1,
    machineId: (flags >> 2) & 7,
    disableReverseCompile: flags & 0x80 ? true : false
  };

  const tempo = d.getUint16(offset, true) || 75;
  offset += 2;

  let voice: VoiceData | null = null;
  const tracks: Array<TrackData | null> = [];
  const rawTracks: Array<ArrayBuffer | null> = [];

  for (let i = 0; i < 18; i++) {
    const trackOffset = d.getUint16(offset + i * 2, true);
    if (0 < trackOffset) {
      const start = trackOffset + root;
      const binary = d.buffer.slice(d.byteOffset + start);
      if (i === 0) {
        voice = parseVoiceTrack(binary);
      } else {
        const rhythm = settings.opllMode === 1 && i === 15;
        tracks[i] = parseTrack(binary, i, rhythm);
      }
      rawTracks[i] = binary;
    } else {
      rawTracks[i] = null;
      tracks[i] = null;
    }
  }

  return {
    version,
    title,
    settings,
    tempo,
    rawTracks,
    voice,
    tracks
  };
}
