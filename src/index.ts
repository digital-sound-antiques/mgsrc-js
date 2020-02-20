import { parseMGS } from "./parser";
import { buildMML } from "./builder";

export * from "./builder";
export * from "./parser";
export * from "./uncompress";

export default function mgs2mml(mgs: ArrayBuffer): string {
  return buildMML(parseMGS(mgs));
}

export function getJumpMarkerCount(mgs: ArrayBuffer): number {
  const data = parseMGS(mgs);
  let res = 0;
  for (let i = 0; i < data.tracks.length; i++) {
    if (data.tracks[i] != null) {
      res += data.tracks[i]!.jumpMarkerCount;
    }
  }
  return res;
}
