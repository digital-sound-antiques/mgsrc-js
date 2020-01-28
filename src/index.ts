import { parseMGS } from "./parser";
import { buildMML } from "./builder";

export * from "./builder";
export * from "./parser";
export * from "./uncompress";

export default function mgs2mml(mgs: ArrayBuffer): string {
  return buildMML(parseMGS(mgs));
}
