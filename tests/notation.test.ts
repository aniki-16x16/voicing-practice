import { strict as assert } from "node:assert";
import { test } from "node:test";
import { keySignature, keySignatureChange, scoreNotation } from "../src/notation.ts";
import { references, rootAtDegree, transposeDegree, degree } from "../src/music.ts";
import type { Beat } from "../src/practice.ts";

test("transposition preserves every altered degree between all supported keys", () => {
  for (const from of references)
    for (const to of references)
      for (let value = 1; value <= 7; value++)
        for (const alteration of [-1, 0, 1]) {
          const original = rootAtDegree(value, from, alteration);
          const next = transposeDegree(original, from, to);
          assert.equal(degree(next, to), degree(original, from));
          assert.equal(transposeDegree(next, to, from), original);
        }
});

test("all major keys have their ordered signatures and clef-specific positions", () => {
  const counts = [0, 5, 2, 3, 4, 1, 6, 6, 1, 4, 3, 2, 5];
  references.forEach((reference, index) => {
    const signs = keySignature(reference);
    assert.equal(signs.length, counts[index]);
    for (let value = 1; value <= 7; value++) {
      const note = rootAtDegree(value, reference);
      assert.equal(signs.find((sign) => sign.letter === note[0])?.accidental || "", note.slice(1));
    }
    signs.forEach((sign) => {
      assert.equal(sign.treble % 7, "CDEFGAB".indexOf(sign.letter));
      assert.equal(sign.bass % 7, "CDEFGAB".indexOf(sign.letter));
    });
  });
  assert.deepEqual(
    keySignature("D").map((sign) => sign.letter),
    ["F", "C"],
  );
  assert.deepEqual(
    keySignature("Eb").map((sign) => sign.letter),
    ["B", "E", "A"],
  );
});

test("key changes cancel removed signs, including returning to C and enharmonic modulation", () => {
  assert.deepEqual(
    keySignatureChange("D", "G").map((sign) => sign.letter + sign.accidental),
    ["C♮", "F#"],
  );
  assert.deepEqual(
    keySignatureChange("Bb", "C").map((sign) => sign.letter + sign.accidental),
    ["B♮", "E♮"],
  );
  assert.equal(keySignatureChange("F#", "Gb").filter((sign) => sign.accidental === "♮").length, 6);
  assert.equal(keySignatureChange("F#", "Gb").filter((sign) => sign.accidental === "b").length, 6);
  assert.equal(keySignatureChange(null, "F#").length, 6);
});

test("diatonic notes use the global signature; chromatic naturals and sharps persist only per bar", () => {
  const beats: Beat[] = [
    { id: 1, root: "F#", quality: "M", reference: "D" },
    { id: 2, root: "F", quality: "M" },
    { id: 3, root: "F", quality: "M" },
    { id: 4, root: "F#", quality: "M" },
    { id: 5, root: "F", quality: "M" },
    null,
    null,
    null,
  ];
  const voices = [66, 65, 65, 66, 65].map((note) => ({
    bass: note - 24,
    left: [note - 24],
    right: [note],
  }));
  const score = scoreNotation(beats, voices);
  for (const staff of [0, 1])
    assert.deepEqual(
      score.map((segment) => segment.staves[staff][0].displayAccidental),
      ["", "♮", "", "#", "♮"],
    );
  assert.deepEqual(
    score.map((segment) => segment.changed),
    [true, false, false, false, false],
  );
});

test("mid-bar modulation resets accidentals immediately, including cancellation back to C", () => {
  const beats: Beat[] = [
    { id: 1, root: "F#", quality: "M" },
    null,
    { id: 2, root: "F#", quality: "M", reference: "D" },
    { id: 3, root: "F", quality: "M", reference: "C" },
  ];
  const score = scoreNotation(
    beats,
    [66, 66, 65].map((note) => ({ bass: note - 24, left: [note - 24], right: [note] })),
  );
  assert.deepEqual(
    score.map((segment) => [segment.beat, segment.reference]),
    [
      [0, "C"],
      [2, "D"],
      [3, "C"],
    ],
  );
  assert.deepEqual(
    score.map((segment) => segment.staves[0][0].displayAccidental),
    ["#", "", ""],
  );
  assert.deepEqual(
    score[2].signature.map((sign) => sign.accidental),
    ["♮", "♮"],
  );
});

test("accidental memory is independent across octaves and staves, and handles double signs", () => {
  const beats: Beat[] = [
    { id: 1, root: "F#", quality: "M" },
    { id: 2, root: "F#", quality: "M" },
    { id: 3, root: "C#", quality: "aug" },
    null,
  ];
  const score = scoreNotation(beats, [
    { bass: 42, left: [42], right: [66] },
    { bass: 54, left: [54], right: [78] },
    { bass: 37, left: [37], right: [69] },
  ]);
  assert.equal(score[1].staves[0][0].displayAccidental, "#");
  assert.equal(score[1].staves[1][0].displayAccidental, "#");
  assert.equal(score[2].staves[0][0].name, "G##");
  assert.equal(score[2].staves[0][0].displayAccidental, "##");
});
