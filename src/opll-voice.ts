export type OPLLSlotParam = {
  am: number;
  pm: number;
  eg: number;
  ml: number;
  kr: number;
  kl: number;
  tl: number;
  ar: number;
  dr: number;
  sl: number;
  rr: number;
  wf: number;
};

export type OPLLVoice = {
  fb: number;
  slots: OPLLSlotParam[];
};

export function toOPLLVoice(d: ArrayLike<number>): OPLLVoice {
  return {
    fb: d[3] & 7,
    slots: [
      {
        am: (d[0] >> 7) & 1,
        pm: (d[0] >> 6) & 1,
        eg: (d[0] >> 5) & 1,
        kr: (d[0] >> 4) & 1,
        ml: d[0] & 0xf,
        kl: (d[2] >> 6) & 3,
        tl: d[2] & 0x3f,
        ar: (d[4] >> 4) & 0xf,
        dr: d[4] & 0xf,
        sl: (d[6] >> 4) & 0xf,
        rr: d[6] & 0xf,
        wf: (d[3] >> 3) & 1
      },
      {
        am: (d[1] >> 7) & 1,
        pm: (d[1] >> 6) & 1,
        eg: (d[1] >> 5) & 1,
        kr: (d[1] >> 4) & 1,
        ml: d[1] & 0xf,
        kl: (d[3] >> 6) & 3,
        tl: 0,
        ar: (d[5] >> 4) & 0xf,
        dr: d[5] & 0xf,
        sl: (d[7] >> 4) & 0xf,
        rr: d[7] & 0xf,
        wf: (d[3] >> 4) & 1
      }
    ]
  };
}
