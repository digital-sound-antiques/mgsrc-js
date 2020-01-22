import { parseMGS } from "./parser";
import { buildMML } from "./builder";
import { isCompressed, uncompress } from "./uncompress";

export * from "./builder";
export * from "./parser";
export * from "./uncompress";

export default function mgs2mml(data: ArrayBuffer): string {
  let src = isCompressed(data) ? uncompress(data) : data;
  const mgs = parseMGS(src);
  return buildMML(mgs);
}
