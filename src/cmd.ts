import fs from "fs";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

import mgs2mml from ".";

const optionDefinitions = [
  {
    name: "output",
    alias: "o",
    typeLabel: "{underline file}",
    description: "Output MML file. The standard output is used if not speicified.",
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
    content: "Reverse Compiler for MGSDRV Format."
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

  const buf = fs.readFileSync(options.input);
  try {
    const mml = mgs2mml(toArrayBuffer(buf));
    if (options.output) {
      fs.writeFileSync(options.output, mml, { encoding: "utf-8" });
    } else {
      process.stdout.write(mml);
      process.stdout.write("\n");
    }
  } catch (e) {
    console.error(e.message);
  }
}

main(process.argv);
