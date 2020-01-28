import fs from "fs";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

import mgs2mml, { uncompress } from ".";
import { parseMGSHeader } from "./parser";

const optionDefinitions = [
  {
    name: "output",
    alias: "o",
    typeLabel: "{underline file}",
    description: "Specify output file. The standard output is used if not speicified.",
    type: String
  },
  {
    name: "input",
    alias: "i",
    typeLabel: "{underline file}",
    defaultOption: true,
    description: "Input MGS file."
  },
  {
    name: "uncompress",
    alias: "u",
    description: "Uncompress input file without decompiling.",
    type: Boolean
  },
  {
    name: "version",
    alias: "v",
    description: "Print version.",
    type: Boolean
  },
  {
    name: "help",
    alias: "h",
    description: "Show this help.",
    type: Boolean
  }
];

const sections = [
  {
    header: "mgsrc-js",
    content: "Decompiler for MGSDRV data object."
  },
  {
    header: "SYNOPSIS",
    content: ["{underline mgsrc-js} [<option>] <file>"]
  },
  {
    header: "OPTIONS",
    optionList: optionDefinitions
  }
];

function main(argv: string[]) {
  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.version) {
    const json = require("../package.json");
    console.info(json.version);
    return;
  }
  if (options.help || options.input == null) {
    console.error(commandLineUsage(sections));
    return;
  }

  function toArrayBuffer(b: Buffer) {
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }

  try {
    const buf = toArrayBuffer(fs.readFileSync(options.input));

    if (options.uncompress) {
      if (!parseMGSHeader(buf).isCompressed) {
        throw Error("Not a compressed MGS file.");
      }
      const out = uncompress(buf);
      if (options.output) {
        fs.writeFileSync(options.output, Buffer.from(out));
      } else {
        process.stdout.write(new Uint8Array(out));
      }
    } else {
      const mml = mgs2mml(buf);
      if (options.output) {
        fs.writeFileSync(options.output, mml, { encoding: "utf-8" });
      } else {
        process.stdout.write(mml);
        process.stdout.write("\n");
      }
    }
  } catch (e) {
    console.error(e);
    // console.error(e.message);
  }
}

main(process.argv);
