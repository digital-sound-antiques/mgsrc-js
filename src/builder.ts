import {
  SccPatch,
  OpllPatch,
  Envelope,
  StepEnvelope,
  ADSREnvelope,
  VoiceData,
  MGSObject,
  TrackCommand,
  TrackData
} from "./types";

import { toOPLLVoice } from "./opll-voice";

function getTrackHeader(trackNumber: number) {
  return "0123456789ABCDEFGH".substr(trackNumber, 1);
}

function _dec(n: number) {
  return (" " + n).slice(-2);
}

function declareSccVoice(patch: SccPatch): string {
  const wav = [];
  for (let i = 0; i < patch.data.length; i++) {
    const d = patch.data[i];
    wav.push(("0" + d.toString(16)).slice(-2));
    if (i === 16) {
      wav.push(" ");
    }
  }
  return `@s${patch.number}={ ${wav.join("")} }`;
}

function declareOpllVoice(patch: OpllPatch): string {
  const voice = toOPLLVoice(patch.data);
  const res = Array<string>();
  res.push(`@v${patch.number} = {\n`);
  res.push(`;       TL FB\n`);
  res.push(`        ${_dec(voice.slots[0].tl)},${_dec(voice.fb)},\n`);
  res.push(`; AR DR SL RR KL ML AM PM EG KR WF\n`);
  for (let i = 0; i < 2; i++) {
    res.push(`  ${_dec(voice.slots[i].ar)},`);
    res.push(`${_dec(voice.slots[i].dr)},`);
    res.push(`${_dec(voice.slots[i].sl)},`);
    res.push(`${_dec(voice.slots[i].rr)},`);
    res.push(`${_dec(voice.slots[i].kl)},`);
    res.push(`${_dec(voice.slots[i].ml)},`);
    res.push(`${_dec(voice.slots[i].am)},`);
    res.push(`${_dec(voice.slots[i].pm)},`);
    res.push(`${_dec(voice.slots[i].eg)},`);
    res.push(`${_dec(voice.slots[i].kr)},`);
    res.push(`${_dec(voice.slots[i].wf)}`);
    res.push(i === 0 ? ",\n" : " }\n");
  }
  return res.join("");
}

export function declareEnvelope(env: Envelope): string {
  if (env.type === "@e") {
    const e = env as StepEnvelope;
    return `@e${e.number}={ ${e.mode}, ${e.nfreq}, ${e.commands.map(e => e.mml).join("")} }`;
  } else {
    const e = env as ADSREnvelope;
    return `@r${e.number}={ ${e.mode}, ${e.nfreq}, ${e.al}, ${e.ar}, ${e.dr}, ${e.sl}, ${e.sr}, ${e.rr} }`;
  }
}

export function buildAllocList(mgs: MGSObject) {
  const allocMap: { [key: number]: number } = {};
  if (mgs.voice) {
    allocMap[0] = mgs.voice.byteLength;
  }
  for (let i = 1; i < 18; i++) {
    const track = mgs.tracks[i];
    if (track) {
      allocMap[i] = track.byteLength;
    }
  }
  const res = [];
  for (const key in allocMap) {
    res.push(`${getTrackHeader(parseInt(key))}=${allocMap[key]}`);
  }
  return `{ ${res.join(", ")} }`;
}

export function buildMMLHeader(mgs: MGSObject) {
  const titleLines = mgs.title
    .split(/\r\n/)
    .filter(e => e !== "")
    .map(e => `"${e}"`);

  let titleBlock;
  if (2 <= titleLines.length) {
    titleBlock = `{\n  ${titleLines.join("\n  ")}\n}`;
  } else {
    titleBlock = `{ ${titleLines.join("\n")} }`;
  }
  return `; MML decompiled from MGS${mgs.version} object.
#opll_mode ${mgs.settings.opllMode}
#lfo_mode ${mgs.settings.lfoMode}
#machine_id ${mgs.settings.machineId}
#title ${titleBlock}
#tempo ${mgs.tempo}
#alloc ${buildAllocList(mgs)}
`;
}

export function buildVoiceMML(data: VoiceData): string {
  const res = Array<string>();
  for (const patch of data.opllPatches) {
    res.push(declareOpllVoice(patch));
  }
  for (const patch of data.sccPatches) {
    res.push(declareSccVoice(patch));
  }
  for (const envelope of data.envelopes) {
    res.push(declareEnvelope(envelope));
  }
  return res.join("\n");
}

export function buildTrackMML(data: TrackData): string {
  const H = getTrackHeader(data.track);
  const res = [];
  let stepCount = 0;
  let inPortamento = false;

  res.push(`\n${H} `);
  for (const cmd of data.commands) {
    if (cmd.count) {
      if (!inPortamento && stepCount > 192) {
        res.push(`\n${H} `);
        stepCount = 0;
      }
      stepCount += cmd.count;
    }
    if (cmd.cmd === 0x57) {
      if (!inPortamento && (cmd.loop === 0 || stepCount > 192)) {
        res.push(`\n${H} `);
        stepCount = 0;
      }
      res.push(cmd.mml + " ");
    } else {
      res.push(cmd.mml);
    }

    if (cmd.cmd === 0x53) {
      inPortamento = true;
    } else if (0x20 <= cmd.cmd && cmd.cmd <= 0x3f) {
      inPortamento = false;
    }
  }
  return res.join("");
}

export function buildMML(mgs: MGSObject): string {
  const res = [];

  res.push(buildMMLHeader(mgs));
  if (mgs.voice) {
    res.push(buildVoiceMML(mgs.voice));
  }

  for (let i = 1; i < 18; i++) {
    const track = mgs.tracks[i];
    if (track) {
      res.push(buildTrackMML(track));
    }
  }

  return res.join("\n");
}