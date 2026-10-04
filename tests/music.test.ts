import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  candidates,
  degree,
  generate,
  mod,
  pc,
  qualities,
  roots,
  selectedIntervals,
  spelling,
  transition,
} from "../src/music.ts";
import type { Chord, Settings } from "../src/music.ts";
const settings: Settings = { preset: "full", movement: "smooth", low: 48, high: 77, span: 12 };
const chords: Chord[] = [
  { id: 1, root: "D", quality: "m7", reference: "C" },
  { id: 2, root: "G", quality: "7" },
  { id: 3, root: "C", quality: "M7" },
];
test("major-reference notation preserves enharmonic spelling", () => {
  assert.equal(degree("A", "C"), "6");
  assert.equal(degree("D", "C"), "2");
  assert.equal(degree("F#", "C"), "#4");
  assert.equal(degree("Gb", "C"), "b5");
  assert.equal(degree("F#", "D"), "3");
  assert.equal(degree("C", "Db"), "7");
});
test("all roots and qualities generate only requested pitches within bounds", () => {
  for (const root of roots)
    for (const quality of Object.keys(qualities))
      for (const preset of ["full", "shell"] as const) {
        const chord = { id: 1, root, quality },
          options = { ...settings, preset, span: 16, high: 84 };
        const { voices, error } = generate([chord], options);
        assert.equal(error, undefined, root + quality);
        const v = voices[0];
        assert.equal(v.bass, 36 + pc(root));
        assert.ok(v.right[0] >= options.low);
        assert.ok(v.right.at(-1)! <= options.high);
        assert.ok(v.right.at(-1)! - v.right[0] <= options.span);
        assert.deepEqual(
          v.right.map((n) => mod(n - pc(root))).sort((a, b) => a - b),
          selectedIntervals(chord, preset)
            .map((n) => mod(n))
            .sort((a, b) => a - b),
        );
        for (const n of [v.bass, ...v.right]) {
          const s = spelling(n, chord);
          assert.equal(pc(s.name), mod(n));
          assert.ok(Number.isInteger(s.octave));
        }
      }
});
test("reference changes do not change actual voicing and output is deterministic", () => {
  const first = generate(chords, settings);
  assert.deepEqual(first, generate(chords, settings));
  assert.deepEqual(
    first,
    generate(
      chords.map((c) => ({ ...c, reference: "D" })),
      settings,
    ),
  );
});
test("impossible constraints return a clear error", () => {
  const r = generate(chords, { ...settings, low: 60, high: 62 });
  assert.equal(r.voices.length, 0);
  assert.ok(r.error?.includes("第 1"));
});
test("whole progression optimum agrees with exhaustive enumeration", () => {
  const options = { ...settings, low: 60, high: 72 },
    layers = chords.map((c) => candidates(c, options)),
    center = 66;
  const local = (v: { right: number[] }) =>
    Math.abs((v.right[0] + v.right.at(-1)!) / 2 - center) * 0.025;
  let minimum = Infinity;
  for (const a of layers[0])
    for (const b of layers[1])
      for (const c of layers[2])
        minimum = Math.min(
          minimum,
          local(a) + local(b) + local(c) + transition(a, b, "smooth") + transition(b, c, "smooth"),
        );
  const v = generate(chords, options).voices;
  assert.ok(
    Math.abs(
      v.reduce((sum, n, i) => sum + local(n) + (i ? transition(v[i - 1], n, "smooth") : 0), 0) -
        minimum,
    ) < 1e-8,
  );
});
test("slash bass and diminished seventh are spelled correctly", () => {
  const c = { id: 1, root: "C", quality: "M7", bass: "E" };
  assert.equal(generate([c], settings).voices[0].bass, 40);
  assert.equal(spelling(69, { id: 2, root: "C", quality: "dim7" }).name, "Bbb");
  assert.equal(spelling(60, { id: 3, root: "C#", quality: "M7" }).name, "B#");
});
