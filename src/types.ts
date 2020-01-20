export type Envelope = {
  number: number;
  type: "@r" | "@e";
  mode: number;
  nfreq: number;
};

export type TextResource = {
  number: number;
  text: string;
};

export type OpllPatchMap = {
  from: number;
  to: number;
};

export type StepEnvelope = Envelope & {
  commands: Array<any>;
};

export type ADSREnvelope = Envelope & {
  al: number;
  ar: number;
  dr: number;
  sl: number;
  sr: number;
  rr: number;
};

export type TrackCommand = {
  cmd: number;
  mml: string;
  loop?: number;
  count?: number;
};

export type TrackData = {
  track: number;
  byteLength: number;
  commands: Array<TrackCommand>;
};

export type OpllPatch = {
  number: number;
  data: number[];
};

export type SccPatch = {
  number: number;
  data: number[];
};

export type VoiceData = {
  byteLength: number;
  opllPatches: Array<OpllPatch>;
  opllPatchMaps: Array<OpllPatchMap>;
  envelopes: Array<StepEnvelope | ADSREnvelope>;
  sccPatches: Array<SccPatch>;
  texts: Array<TextResource>;
  psgTunes: number[];
  opllTunes: number[];
};

export type MGSObject = {
  version: string;
  title: string;
  settings: {
    opllMode: number;
    lfoMode: number;
    machineId: number;
    disableReverseCompile: boolean;
  };
  tempo: number;
  rawTracks: Array<ArrayBuffer | null>;
  voice?: VoiceData | null;
  tracks: Array<TrackData | null>;
};
