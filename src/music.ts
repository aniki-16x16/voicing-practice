export const roots = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];
export const references = ["C", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
export const qualities: Record<string, number[]> = {
  M: [0, 4, 7],
  m: [0, 3, 7],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  "7": [0, 4, 7, 10],
  M9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  "9": [0, 4, 7, 10, 14],
  aug: [0, 4, 8],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  mM7: [0, 3, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  Madd9: [0, 4, 7, 14],
  "7(b9)": [0, 4, 7, 10, 13],
  "7(#5,b9)": [0, 4, 8, 10, 13],
  aug7: [0, 4, 8, 10],
  augM7: [0, 4, 8, 11],
  dimM7: [0, 3, 6, 11],
};
export const baseQualities = [
  { value: "M", label: "M · 大三" },
  { value: "m", label: "m · 小三" },
  { value: "dim", label: "dim · 减三" },
  { value: "aug", label: "aug · 增三" },
  { value: "M7", label: "M7 · 大七" },
  { value: "7", label: "7 · 属七" },
  { value: "m7", label: "m7 · 小七" },
  { value: "mM7", label: "mM7 · 小大七" },
  { value: "m7b5", label: "m7♭5 · 半减七" },
  { value: "dim7", label: "dim7 · 减七" },
  { value: "dimM7", label: "dimM7 · 减大七" },
  { value: "aug7", label: "aug7 · 增七" },
  { value: "augM7", label: "augM7 · 增大七" },
];
export const extraOptions = [
  { value: "sus2", label: "sus2 · 挂二", interval: 2 },
  { value: "sus4", label: "sus4 · 挂四", interval: 5 },
  { value: "6", label: "6 · 六度", interval: 9 },
  { value: "b9", label: "♭9 · 降九", interval: 13 },
  { value: "9", label: "9 · 九度", interval: 14 },
  { value: "#9", label: "♯9 · 升九", interval: 15 },
  { value: "11", label: "11 · 十一度", interval: 17 },
  { value: "#11", label: "♯11 · 升十一", interval: 18 },
  { value: "b13", label: "♭13 · 降十三", interval: 20 },
  { value: "13", label: "13 · 十三度", interval: 21 },
];
const legacyParts: Record<string, { base: string; extras: string[] }> = {
  M9: { base: "M7", extras: ["9"] },
  m9: { base: "m7", extras: ["9"] },
  "9": { base: "7", extras: ["9"] },
  sus2: { base: "M", extras: ["sus2"] },
  sus4: { base: "M", extras: ["sus4"] },
  "7sus4": { base: "7", extras: ["sus4"] },
  Madd9: { base: "M", extras: ["9"] },
  "7(b9)": { base: "7", extras: ["b9"] },
  "7(#5,b9)": { base: "aug7", extras: ["b9"] },
};
const natural = [0, 2, 4, 5, 7, 9, 11];
const letters = ["C", "D", "E", "F", "G", "A", "B"];
export const mod = (n: number, m = 12) => ((n % m) + m) % m;
export function pc(name: string) {
  return mod(
    natural[letters.indexOf(name[0])] +
      [...name.slice(1)].reduce((n, a) => n + (a === "#" ? 1 : a === "b" ? -1 : 0), 0),
  );
}
export interface Chord {
  id: number;
  root: string;
  quality: string;
  extras?: string[];
  reference?: string;
  bass?: string;
}
export interface Settings {
  preset: "full" | "shell";
  movement: "smooth" | "up" | "down";
  low: number;
  high: number;
  span: number;
}
export interface Voicing {
  bass: number;
  right: number[];
}
export interface InversionAnchor {
  chordId: number;
  tone: number;
  rotate: boolean;
}
export function inversionOptions(c: Chord, preset: Settings["preset"]) {
  const classical = preset === "full" && chordParts(c).extras.length === 0;
  return selectedIntervals(c, preset).map((tone, index) => {
    const note = spelling(60 + pc(c.root) + tone, c).name;
    const name = classical ? ["原位", "第一转位", "第二转位", "第三转位"][index] : `最低音 ${note}`;
    return { tone, name, label: classical ? `${name} · 最低音 ${note}` : name };
  });
}
export function nextInversion(
  anchor: InversionAnchor | null,
  chords: Chord[],
  settings: Settings,
): InversionAnchor | null {
  if (!anchor?.rotate) return anchor;
  const chord = chords.find((c) => c.id === anchor.chordId);
  if (!chord) return null;
  const tones = selectedIntervals(chord, settings.preset);
  const index = tones.indexOf(anchor.tone);
  return index < 0 ? anchor : { ...anchor, tone: tones[(index + 1) % tones.length] };
}
export function degree(root: string, reference: string) {
  const d = mod(letters.indexOf(root[0]) - letters.indexOf(reference[0]), 7);
  let delta = mod(pc(root) - pc(reference) - natural[d]);
  if (delta > 6) delta -= 12;
  return (delta > 0 ? "#".repeat(delta) : "b".repeat(-delta)) + (d + 1);
}
/** Spell a natural major-scale degree with its optional chromatic alteration. */
export function rootAtDegree(value: number, reference: string, alteration = 0) {
  const letter = mod(letters.indexOf(reference[0]) + value - 1, 7);
  let accidental = mod(pc(reference) + natural[value - 1] + alteration - natural[letter]);
  if (accidental > 6) accidental -= 12;
  return letters[letter] + (accidental > 0 ? "#".repeat(accidental) : "b".repeat(-accidental));
}
/** Keep the written scale degree and its alteration when changing key. */
export function transposeDegree(note: string, from: string, to: string) {
  const value = degree(note, from);
  const signs = value.slice(0, -1);
  const alteration = signs.length * (signs.startsWith("b") ? -1 : 1);
  return rootAtDegree(Number(value.at(-1)), to, alteration);
}
export function chordParts(c: Chord) {
  const legacy = legacyParts[c.quality];
  const chosen = new Set([...(legacy?.extras || []), ...(c.extras || [])]);
  return {
    base: legacy?.base || c.quality,
    extras: extraOptions.filter((option) => chosen.has(option.value)).map((option) => option.value),
  };
}
export function referenceAt(chords: Chord[], index: number) {
  let ref = "C";
  for (let i = 0; i <= index; i++) ref = chords[i].reference || ref;
  return ref;
}
export function chordName(c: Chord) {
  return c.root + chordQuality(c) + (c.bass ? "/" + c.bass : "");
}
export function chordQuality(c: Chord) {
  const { base, extras } = chordParts(c);
  // Keep familiar symbols for the previously supported ninth and suspended chords.
  const legacy = Object.entries(legacyParts).find(
    ([, parts]) =>
      parts.base === base &&
      parts.extras.length === extras.length &&
      parts.extras.every((extra) => extras.includes(extra)),
  );
  if (legacy) return legacy[0];
  return base + (extras.length ? `(${extras.join(",")})` : "");
}
function coreIntervals(c: Chord) {
  const { base, extras } = chordParts(c);
  const suspended = extras.filter((extra) => extra === "sus2" || extra === "sus4");
  const core = qualities[base];
  if (!suspended.length) return core;
  // 挂留替换三音；同时选择挂二、挂四时两者均保留。
  return [0, ...suspended.map((extra) => (extra === "sus2" ? 2 : 5)), ...core.slice(2)];
}
export function chordIntervals(c: Chord) {
  const { extras } = chordParts(c);
  const intervals = [
    ...coreIntervals(c),
    ...extraOptions
      .filter((extra) => extras.includes(extra.value) && !extra.value.startsWith("sus"))
      .map((extra) => extra.interval),
  ];
  // 如 sus2 + 9、6 + 13 是同一个音级，只安排一个声部。
  return intervals.filter(
    (interval, index) => intervals.findIndex((other) => mod(other) === mod(interval)) === index,
  );
}
export function selectedIntervals(c: Chord, preset: Settings["preset"]) {
  if (preset === "full") return chordIntervals(c);
  const { base, extras } = chordParts(c);
  const core = coreIntervals(c);
  if (qualities[base].length === 3) return core;
  // Shell 保留根音、三音（或所有挂留音）与七音，不加入延伸音。
  return [
    0,
    ...core.slice(1, extras.includes("sus2") && extras.includes("sus4") ? 3 : 2),
    qualities[base][3],
  ];
}
export function candidates(c: Chord, settings: Settings, lowestTone?: number): Voicing[] {
  const intervals = selectedIntervals(c, settings.preset);
  const pitches = intervals.map((i) => mod(pc(c.root) + i));
  const bass = 36 + pc(c.bass || c.root);
  const result: Voicing[] = [];
  const walk = (notes: number[], used: number[]) => {
    if (notes.length === pitches.length) {
      result.push({ bass, right: notes });
      return;
    }
    for (
      let n = notes.length ? notes[notes.length - 1] + 1 : settings.low;
      n <= settings.high;
      n++
    ) {
      const p = pitches.indexOf(mod(n));
      if (!notes.length && lowestTone !== undefined && mod(n) !== mod(pc(c.root) + lowestTone))
        continue;
      if (p < 0 || used.includes(p) || (notes.length && n - notes[0] > settings.span)) continue;
      walk([...notes, n], [...used, p]);
    }
  };
  walk([], []);
  return result;
}
export function transition(a: Voicing, b: Voicing, movement: Settings["movement"]) {
  // Align ordered voices; inserting or removing a voice has an explicit cost.
  const x = a.right,
    y = b.right;
  const dp = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j * 9 : j === 0 ? i * 9 : Infinity)),
  );
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++) {
      const distance = Math.abs(x[i - 1] - y[j - 1]);
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + distance + Math.max(0, distance - 5) * 2,
        dp[i - 1][j] + 9,
        dp[i][j - 1] + 9,
      );
    }
  const top = y[y.length - 1] - x[x.length - 1];
  const direction =
    movement === "up" ? Math.max(0, -top) * 5 : movement === "down" ? Math.max(0, top) * 5 : 0;
  return dp[x.length][y.length] + Math.abs(a.bass - b.bass) * 0.15 + direction;
}
export function generate(
  chords: Chord[],
  settings: Settings,
  anchor: InversionAnchor | null = null,
): { voices: Voicing[]; error?: string } {
  if (!chords.length) return { voices: [] };
  const target = anchor && chords.find((c) => c.id === anchor.chordId);
  if (anchor && (!target || !selectedIntervals(target, settings.preset).includes(anchor.tone)))
    return {
      voices: [],
      error: "指定转位不适用于当前和弦或 Voicing 预设，请重新选择右手转位或改为自动。",
    };
  const layers = chords.map((c) =>
    candidates(c, settings, anchor?.chordId === c.id ? anchor.tone : undefined),
  );
  const empty = layers.findIndex((l) => !l.length);
  if (empty >= 0)
    return {
      voices: [],
      error: `第 ${empty + 1} 个和弦 ${chordName(chords[empty])}${anchor?.chordId === chords[empty].id ? " 的指定右手转位" : ""} 没有符合条件的排列。请扩大右手音区或跨度${anchor?.chordId === chords[empty].id ? "，或修改转位；自动轮换不会跳过此转位" : ""}。`,
    };
  const center = (settings.low + settings.high) / 2;
  const local = (v: Voicing) =>
    Math.abs((v.right[0] + v.right[v.right.length - 1]) / 2 - center) * 0.025;
  let costs = layers[0].map(local);
  const back: number[][] = [layers[0].map(() => -1)];
  for (let i = 1; i < layers.length; i++) {
    const parents: number[] = [];
    const next = layers[i].map((v) => {
      let best = Infinity,
        parent = 0;
      layers[i - 1].forEach((previous, j) => {
        const cost = costs[j] + transition(previous, v, settings.movement) + local(v);
        if (cost < best) {
          best = cost;
          parent = j;
        }
      });
      parents.push(parent);
      return best;
    });
    back.push(parents);
    costs = next;
  }
  let index = costs.indexOf(Math.min(...costs));
  const voices: Voicing[] = Array(layers.length);
  for (let i = layers.length - 1; i >= 0; i--) {
    voices[i] = layers[i][index];
    index = back[i][index];
  }
  return { voices };
}
export function noteName(midi: number) {
  return (
    ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][mod(midi)] +
    (Math.floor(midi / 12) - 1)
  );
}
export function spelling(midi: number, c: Chord, bass = false) {
  let name = c.bass && bass ? c.bass : c.root;
  if (!bass || !c.bass) {
    const interval = chordIntervals(c).find((i) => mod(pc(c.root) + i) === mod(midi)) ?? 0;
    let step =
      interval === 0
        ? 0
        : interval === 13 || interval === 14 || interval === 15
          ? 1
          : interval === 2
            ? 1
            : interval === 3 || interval === 4
              ? 2
              : interval === 5 || interval === 17 || interval === 18
                ? 3
                : interval === 6 || interval === 7 || interval === 8
                  ? 4
                  : interval === 9 || interval === 20 || interval === 21
                    ? 5
                    : 6;
    if (interval === 9 && chordParts(c).base === "dim7") step = 6;
    name = letters[mod(letters.indexOf(c.root[0]) + step, 7)];
    let accidental = mod(mod(midi) - natural[letters.indexOf(name)]);
    if (accidental > 6) accidental -= 12;
    name += accidental > 0 ? "#".repeat(accidental) : "b".repeat(-accidental);
  }
  const letter = letters.indexOf(name[0]);
  const accidental = [...name.slice(1)].reduce((n, a) => n + (a === "#" ? 1 : -1), 0);
  const octave = (midi - natural[letter] - accidental) / 12 - 1;
  return { name, octave, diatonic: octave * 7 + letter, accidental: name.slice(1) };
}
