import { parseMGS } from "./parser";
import { buildMML } from "./builder";

export * from "./builder";
export * from "./parser";

export default function mgs2mml(data: ArrayBuffer): string {
  const mgs = parseMGS(data);
  return buildMML(mgs);
}
