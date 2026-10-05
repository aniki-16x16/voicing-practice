import { voicingSpelling } from "./music.ts";
import type { Voicing } from "./music";
import { scoreSegments, timeline } from "./practice.ts";
import type { Beat } from "./practice";

const keyCounts: Record<string, number> = {
  C: 0,
  Db: -5,
  D: 2,
  Eb: -3,
  E: 4,
  F: -1,
  "F#": 6,
  Gb: -6,
  G: 1,
  Ab: -4,
  A: 3,
  Bb: -2,
  B: 5,
};
const sharpOrder = ["F", "C", "G", "D", "A", "E", "B"];
const flatOrder = ["B", "E", "A", "D", "G", "C", "F"];
const sharpPositions = [
  [38, 35, 39, 36, 33, 37, 34],
  [24, 21, 25, 22, 19, 23, 20],
];
const flatPositions = [
  [34, 37, 33, 36, 32, 35, 31],
  [20, 23, 19, 22, 18, 21, 17],
];

export function keySignature(reference: string) {
  const count = keyCounts[reference] ?? 0;
  const order = count > 0 ? sharpOrder : flatOrder;
  const positions = count > 0 ? sharpPositions : flatPositions;
  return order.slice(0, Math.abs(count)).map((letter, index) => ({
    letter,
    accidental: count > 0 ? "#" : "b",
    treble: positions[0][index],
    bass: positions[1][index],
  }));
}

/** Naturals cancel removed signs, then the complete new key signature follows. */
export function keySignatureChange(previous: string | null, reference: string) {
  const next = keySignature(reference);
  const cancellations =
    previous === null
      ? []
      : keySignature(previous)
          .filter(
            (old) =>
              !next.some(
                (sign) => sign.letter === old.letter && sign.accidental === old.accidental,
              ),
          )
          .map((sign) => ({ ...sign, accidental: "♮" }));
  return [...cancellations, ...next];
}

export function scoreNotation(beats: Beat[], voices: Voicing[]) {
  const { chords, indices } = timeline(beats);
  let reference = "C";
  let previous: string | null = null;
  const states = [new Map<number, string | null>(), new Map<number, string | null>()];
  return scoreSegments(beats).map(({ beat, duration }) => {
    const chord = chords[indices[beat]];
    const voice = voices[indices[beat]];
    reference = beats[beat]?.reference || reference;
    const changed = reference !== previous;
    const signature = changed ? keySignatureChange(previous, reference) : [];
    if (beat % 4 === 0 || changed) states.forEach((state) => state.clear());
    previous = reference;
    const defaults = new Map(keySignature(reference).map((sign) => [sign.letter, sign.accidental]));
    const staves = [voice?.right || [], voice?.left || []].map((notes, staff) => {
      const state = states[staff];
      const positions = notes.map((note) => voicingSpelling(note, chord, voice));
      // 同一和弦中同字母、同八度的不同变化音都需明确标记。
      const conflicts = new Set(
        positions
          .filter((note) =>
            positions.some(
              (other) => other.diatonic === note.diatonic && other.accidental !== note.accidental,
            ),
          )
          .map((note) => note.diatonic),
      );
      return positions.map((note) => {
        const current = state.has(note.diatonic)
          ? state.get(note.diatonic)
          : defaults.get(note.name[0]) || "";
        const displayAccidental =
          current === note.accidental && !conflicts.has(note.diatonic)
            ? ""
            : note.accidental || "♮";
        state.set(note.diatonic, conflicts.has(note.diatonic) ? null : note.accidental);
        return { ...note, displayAccidental };
      });
    });
    return { beat, duration, reference, changed, signature, staves, voice };
  });
}
