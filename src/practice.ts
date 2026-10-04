import type { Chord } from "./music";

export type Beat = Chord | null;
export function adjacentChordBeat(beats: Beat[], current: number, direction: -1 | 1) {
  const starts = beats.flatMap((chord, beat) => (chord ? [beat] : []));
  if (!starts.length) return current;
  return direction === 1
    ? (starts.find((beat) => beat > current) ?? starts[0])
    : (starts.findLast((beat) => beat < current) ?? starts.at(-1)!);
}

/** Removing an event leaves its slot as a sustain, or a rest before the first chord. */
export function removeChordAt(beats: Beat[], beat: number): Beat[] {
  const removed = beats[beat];
  if (!removed) return beats;
  const next = beats.map((chord, index) => (index === beat ? null : chord));
  const following = next.findIndex((chord, index) => index > beat && chord !== null);
  // 分段调式属于后续整段，删除标记所在和弦时保留它的参照，不覆盖下一段的参照。
  if (removed.reference && following >= 0 && !next[following]!.reference)
    next[following] = { ...next[following]!, reference: removed.reference };
  return next;
}
export function timeline(beats: Beat[]) {
  const chords: Chord[] = [],
    starts: number[] = [],
    indices: number[] = [];
  beats.forEach((chord, beat) => {
    if (chord) {
      chords.push(chord);
      starts.push(beat);
    }
    indices.push(chords.length - 1);
  });
  return { chords, starts, indices };
}

/** Assign a different column to every adjacent staff position, regardless of array parity. */
export function noteOffsets(positions: number[], separation = 18) {
  const columns: number[] = [];
  positions.forEach((position, i) => {
    const occupied = new Set(columns.filter((_, j) => Math.abs(positions[j] - position) <= 1));
    let column = 0;
    while (occupied.has(column)) column += separation;
    columns[i] = column;
  });
  return columns;
}

export function durationAt(beats: Beat[], beat: number) {
  let end = beat + 1;
  while (end < beats.length && end % 4 !== 0 && !beats[end]) end++;
  return end - beat;
}

/** Sustains take no extra horizontal cells; retain a note at each bar boundary. */
export function scoreSegments(beats: Beat[]) {
  return beats.flatMap((chord, beat) =>
    chord || beat % 4 === 0 ? [{ beat, duration: durationAt(beats, beat) }] : [],
  );
}

/** Reference labels appear only at the first beat and at actual reference changes. */
export function referenceMarkers(beats: Beat[]) {
  let reference = "C";
  return beats.map((chord, beat) => {
    const next = chord?.reference || reference;
    const marker = beat === 0 || next !== reference ? next : null;
    reference = next;
    return marker;
  });
}
