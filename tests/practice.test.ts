import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  durationAt,
  noteOffsets,
  timeline,
  scoreSegments,
  referenceMarkers,
} from "../src/practice.ts";
import type { Beat } from "../src/practice.ts";

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
