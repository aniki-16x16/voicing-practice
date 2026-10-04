import type { Chord } from "./music";

export type Beat = Chord | null;
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
