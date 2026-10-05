import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  durationAt,
  noteOffsets,
  timeline,
  scoreSegments,
  referenceMarkers,
  adjacentChordBeat,
  removeChordAt,
  removeBarAt,
  changeReference,
} from "../src/practice.ts";
import { degree, generate, pc } from "../src/music.ts";
import type { Beat } from "../src/practice.ts";

test("changing a key preserves root and slash-bass degrees throughout only its segment", () => {
  const beats: Beat[] = [
    { id: 1, root: "D", quality: "m7", reference: "C", bass: "F#", extras: ["9"] },
    null,
    { id: 2, root: "Gb", quality: "7" },
    null,
    { id: 3, root: "C", quality: "M7", reference: "C" },
    null,
    null,
    null,
  ];
  const next = changeReference(beats, 0, "D");
  assert.equal(next[0]!.root, "E");
  assert.equal(next[0]!.bass, "G#");
  assert.equal(next[2]!.root, "Ab");
  assert.equal(degree(next[2]!.root, "D"), "b5");
  assert.deepEqual(next[0]!.extras, ["9"]);
  assert.equal(next[0]!.id, 1);
  assert.equal(next[4], beats[4]); // 同调显式标记也构成下一段边界。
  assert.equal(next[1], null);
  assert.equal(beats[0]!.root, "D");
  const settings = { preset: "full", movement: "smooth", low: 48, high: 77, span: 12 } as const;
  const result = generate(
    next.filter((chord) => chord !== null),
    settings,
    { chordId: 1, tone: 3, rotate: false },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.voices[0].bass, 36 + pc("G#"));
  assert.equal(result.voices[0].right[0] % 12, (pc("E") + 3) % 12);
  assert.deepEqual(changeReference(next, 0, "C"), beats);
});

test("inserting and removing a mid-bar key transposes inherited degrees and keeps later keys", () => {
  const beats: Beat[] = [
    { id: 1, root: "D", quality: "M", reference: "D" },
    null,
    { id: 2, root: "F#", quality: "m", bass: "A" },
    { id: 3, root: "A", quality: "7" },
    { id: 4, root: "Bb", quality: "M", reference: "Bb" },
    null,
    null,
    null,
  ];
  const next = changeReference(beats, 2, "Gb");
  assert.equal(next[0], beats[0]);
  assert.equal(next[2]!.root, "Bb");
  assert.equal(next[2]!.bass, "Db");
  assert.equal(next[3]!.root, "Db");
  assert.equal(next[4], beats[4]);
  assert.deepEqual(changeReference(next, 2), beats);
  assert.equal(changeReference(beats, 1, "C"), beats);
});

test("score packs sustained beats without losing durations or bar boundaries", () => {
  const chord = { id: 1, root: "C", quality: "M7" };
  const beats: Beat[] = [chord, null, null, null, null, null, chord, null];
  assert.deepEqual(scoreSegments(beats), [
    { beat: 0, duration: 4 },
    { beat: 4, duration: 2 },
    { beat: 6, duration: 2 },
  ]);
  assert.equal(scoreSegments([chord, chord, chord, chord]).length, 4);
});

test("chord navigation skips sustained beats and wraps between configured events", () => {
  const c = { id: 1, root: "C", quality: "M" };
  const beats: Beat[] = [c, null, null, { ...c, id: 2 }, null, { ...c, id: 3 }, null, null];
  assert.equal(adjacentChordBeat(beats, 0, 1), 3);
  assert.equal(adjacentChordBeat(beats, 3, 1), 5);
  assert.equal(adjacentChordBeat(beats, 5, 1), 0);
  assert.equal(adjacentChordBeat(beats, 0, -1), 5);
  assert.equal(adjacentChordBeat(beats, 4, -1), 3);
  assert.equal(adjacentChordBeat([null, null, c, null], 0, 1), 2);
  assert.equal(adjacentChordBeat([null, null, null, null], 2, 1), 2);
});

test("deleting a chord keeps beat positions and the reference for its surviving segment", () => {
  const c = { id: 1, root: "D", quality: "M", reference: "D" };
  const beats: Beat[] = [c, null, { id: 2, root: "A", quality: "7" }, null];
  const removed = removeChordAt(beats, 0);
  assert.equal(removed.length, 4);
  assert.equal(removed[0], null);
  assert.equal(removed[2]!.reference, "D");
  assert.equal(beats[0], c);
  assert.equal(beats[2]!.reference, undefined);
  assert.deepEqual(timeline(removed).indices, [-1, -1, 0, 0]);
  assert.equal(
    removeChordAt([c, null, { ...c, id: 2, reference: "E" }, null], 0)[2]!.reference,
    "E",
  );
  assert.deepEqual(removeChordAt([c, null, null, null], 0), [null, null, null, null]);
  assert.equal(removeChordAt(beats, 1), beats);
});

test("deleting a bar removes exactly its slots and preserves the following reference", () => {
  const c = { id: 1, root: "C", quality: "M", reference: "C" };
  const d = { id: 2, root: "D", quality: "M", reference: "D" };
  const e = { id: 3, root: "E", quality: "M", reference: "E" };
  const g = { id: 4, root: "G", quality: "7" };
  const beats: Beat[] = [c, null, null, null, d, null, e, null, null, g, null, null];
  const next = removeBarAt(beats, 1);
  assert.deepEqual(next, [c, null, null, null, null, { ...g, reference: "E" }, null, null]);
  assert.equal(beats.length, 12);
  assert.equal(g.reference, undefined);
  assert.equal(
    removeBarAt([...beats.slice(0, 9), { ...g, reference: "F" }, null, null], 1)[5]!.reference,
    "F",
  );
  assert.deepEqual(removeBarAt([null, null, null, null, c, null, null, null], 0), [
    c,
    null,
    null,
    null,
  ]);
  assert.deepEqual(removeBarAt([c, null, null, null], 0), []);
  assert.equal(removeBarAt(beats, 3), beats);
  assert.equal(removeBarAt(beats, -1), beats);
});

test("reference labels appear exactly at changes, including mid-bar", () => {
  const c = { id: 1, root: "C", quality: "M7" };
  assert.deepEqual(
    referenceMarkers([
      c,
      null,
      { ...c, reference: "D" },
      null,
      { ...c, reference: "D" },
      null,
      { ...c, reference: "C" },
      null,
    ]),
    ["C", null, "D", null, null, null, "C", null],
  );
});

test("seconds starting at even and odd indices are separated; chains alternate", () => {
  assert.deepEqual(noteOffsets([28, 30, 31]), [0, 0, 18]);
  assert.deepEqual(noteOffsets([28, 29, 31, 32]), [0, 18, 0, 18]);
  assert.deepEqual(noteOffsets([28, 29, 30, 31]), [0, 18, 0, 18]);
  assert.deepEqual(noteOffsets([28, 28, 29]), [0, 18, 36]);
  for (const positions of [
    [28, 30, 31],
    [28, 29, 30, 31],
    [28, 28, 29],
    [28, 31, 32, 34, 35],
  ]) {
    const x = noteOffsets(positions);
    for (let i = 0; i < positions.length; i++)
      for (let j = 0; j < i; j++)
        if (Math.abs(positions[i] - positions[j]) <= 1) assert.ok(Math.abs(x[i] - x[j]) >= 18);
  }
});
test("four beat slots sustain prior harmony and allow changes on every beat", () => {
  const d = { id: 1, root: "D", quality: "m7" },
    g = { id: 2, root: "G", quality: "7" },
    c = { id: 3, root: "C", quality: "M7" };
  const beats: Beat[] = [d, null, g, c, null, null, null, null];
  assert.deepEqual(timeline(beats), {
    chords: [d, g, c],
    starts: [0, 2, 3],
    indices: [0, 0, 1, 2, 2, 2, 2, 2],
  });
  assert.equal(durationAt(beats, 0), 2);
  assert.equal(durationAt(beats, 2), 1);
  assert.equal(durationAt(beats, 3), 1);
  assert.equal(durationAt(beats, 4), 4);
  assert.equal(durationAt([d, null, null, c], 0), 3);
});
