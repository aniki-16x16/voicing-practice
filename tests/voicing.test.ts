import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  candidates,
  chordIntervals,
  generate,
  mod,
  omittedNotes,
  pc,
  roots,
  voicingPresets,
  nextInversion,
  voicingSpelling,
  transition,
  voicingCost,
} from "../src/music.ts";
import { scoreNotation } from "../src/notation.ts";
import type { Chord, Settings, Voicing } from "../src/music.ts";

const defaults: Settings = {
  preset: "basic",
  movement: "smooth",
  low: 48,
  high: 77,
  span: 12,
  handLimit: 4,
};
const chord: Chord = { id: 1, root: "C", quality: "7", extras: ["9", "13"] };
const play = (c: Chord, patch: Partial<Settings> = {}) => {
  const result = generate([c], { ...defaults, ...patch });
  assert.equal(result.error, undefined, JSON.stringify({ c, patch }));
  return result.voices[0];
};
const classes = (notes: number[]) =>
  [...new Set(notes.map((note) => mod(note)))].sort((a, b) => a - b);

test("basic keeps the complete skeleton and adds extensions only within count and span", () => {
  const c = { ...chord, extras: ["9"] };
  const four = play(c);
  assert.deepEqual(classes(four.right), [0, 4, 7, 10]);
  assert.deepEqual(omittedNotes(c, four), ["D"]);
  const five = play(c, { handLimit: 5 });
  assert.deepEqual(classes(five.right), [0, 2, 4, 7, 10]);
  assert.deepEqual(omittedNotes(c, five), []);
  const cramped = play({ id: 2, root: "C", quality: "M", extras: ["13"] }, { low: 60, high: 67 });
  assert.equal(cramped.right.length, 3);
  assert.deepEqual(omittedNotes({ id: 2, root: "C", quality: "M", extras: ["13"] }, cramped), [
    "A",
  ]);
});

test("a long repeated progression keeps anchor and chord-specific extensions independent", () => {
  const progression = Array.from({ length: 128 }, (_, id) => ({
    id,
    root: ["C", "F", "G", "D"][id % 4],
    quality: "7",
    extras: ["9", "#11", "13"],
  }));
  const options = { ...defaults, preset: "both-rich" as const, span: 16, handLimit: 5 as const };
  const result = generate(progression, options, { chordId: 64, tone: 4, rotate: false });
  assert.equal(result.error, undefined);
  assert.equal(result.voices.length, 128);
  assert.equal(mod(result.voices[64].right[0]), 4);
  for (let i = 0; i < progression.length; i++) {
    const v = result.voices[i];
    assert.equal(v.bass, 36 + pc(progression[i].root));
    assert.ok(v.left.length <= 5 && v.right.length <= 5);
  }
});

test("rootless reallocates root and plain fifth space to the explicitly chosen colors", () => {
  const v = play(chord, { preset: "rootless" });
  assert.deepEqual(v.left, [36]);
  assert.deepEqual(classes(v.right), [2, 4, 9, 10]);
  assert.deepEqual(omittedNotes(chord, v), ["G"]);
  assert.ok(!v.right.some((note) => mod(note) === 0));
  const basicTriad = play({ id: 2, root: "C", quality: "M" }, { preset: "rootless" });
  assert.deepEqual(classes(basicTriad.right), [4, 7]);
});

test("right-rich repeats only existing roots or plain fifths in different octaves", () => {
  const c = { id: 2, root: "C", quality: "M" };
  const v = play(c, { preset: "right-rich" });
  assert.equal(v.right.length, 4);
  assert.deepEqual(classes(v.right), [0, 4, 7]);
  assert.deepEqual(v.left, [36]);
  for (const candidate of candidates(chord, {
    ...defaults,
    preset: "right-rich",
    handLimit: 5,
    span: 16,
  })) {
    const counts = new Map<number, number>();
    for (const note of candidate.right) counts.set(mod(note), (counts.get(mod(note)) || 0) + 1);
    for (const [pitch, count] of counts)
      if (count > 1) {
        assert.ok([0, 7].includes(pitch));
        assert.equal(count, 2);
      }
  }
});

test("left-rich preserves the bass and gains safe support choices as span increases", () => {
  const c = { id: 2, root: "C", quality: "M", extras: ["9"] };
  const tight = candidates(c, { ...defaults, preset: "left-rich" });
  assert.ok(tight.some((v) => v.left.join() === "36,43,48"));
  assert.ok(tight.every((v) => !v.left.includes(50) && !v.left.includes(52)));
  const ninth = candidates(c, { ...defaults, preset: "left-rich", span: 14 });
  assert.ok(ninth.some((v) => v.left.join() === "36,43,50"));
  assert.ok(ninth.every((v) => !v.left.includes(52)));
  const tenth = candidates(c, { ...defaults, preset: "left-rich", span: 16 });
  assert.ok(tenth.some((v) => v.left.join() === "36,43,52"));
  const v = play({ id: 3, root: "C", quality: "7" }, { preset: "left-rich" });
  assert.deepEqual(v.left, [36, 43, 48]);
  assert.deepEqual(classes(v.right), [4, 10]);
  assert.ok(v.left.every((note) => ![40, 46].includes(note)));
});

test("both-rich has multiple notes in each hand without losing chord identity", () => {
  const c = { id: 2, root: "C", quality: "7" };
  const v = play(c, { preset: "both-rich" });
  assert.ok(v.left.length >= 2);
  assert.ok(v.right.length >= 3);
  assert.ok([0, 4, 10].every((pitch) => classes([...v.left, ...v.right]).includes(pitch)));
});

test("all six presets obey each hand's count, span, spelling and crossing rules across roots", () => {
  for (const preset of voicingPresets)
    for (const root of roots)
      for (const quality of ["M", "m7", "7", "dim7", "augM7", "m7b5", "7(#5,b9)"])
        for (const handLimit of [4, 5] as const) {
          const c = { id: 1, root, quality };
          const options = { ...defaults, preset: preset.value, handLimit };
          const v = play(c, options);
          assert.equal(v.left[0], 36 + pc(root));
          assert.equal(v.bass, v.left[0]);
          const allowed = chordIntervals(c).map((tone) => mod(pc(root) + tone));
          for (const hand of [v.left, v.right]) {
            assert.ok(hand.length <= handLimit && hand.length > 0);
            assert.ok(hand.at(-1)! - hand[0] <= options.span);
            assert.equal(new Set(hand).size, hand.length);
            for (const note of hand) {
              assert.ok(allowed.includes(mod(note)));
              const s = voicingSpelling(note, c, v);
              assert.equal(pc(s.name), mod(note));
              assert.ok(Number.isInteger(s.octave));
            }
          }
          assert.ok(v.right[0] > v.left.at(-1)!);
          assert.ok(v.right[0] >= options.low && v.right.at(-1)! <= options.high);
          for (let i = 1; i < v.left.length; i++) {
            assert.ok(v.left[i] - v.left[i - 1] >= (v.left[i - 1] < 48 ? 5 : 3));
            assert.ok(v.left[i] - v.bass >= 12 || v.left[i] - v.bass === 7);
          }
        }
});

test("slash bass and its octave use bass spelling, while other left notes keep chord spelling", () => {
  const c = { id: 1, root: "C#", quality: "M", bass: "Db" };
  const v = play(c, { preset: "both-rich" });
  assert.equal(v.bass, 37);
  assert.ok(v.left.length > 1);
  assert.equal(voicingSpelling(v.bass, c, v).name, "Db");
  assert.equal(voicingSpelling(v.bass + 12, c, { ...v, left: [v.bass, v.bass + 12] }).name, "Db");
  const mixed: Voicing = { bass: 40, left: [40, 52, 55], right: [60, 64, 71] };
  const slash = { id: 2, root: "C", quality: "M7", bass: "E" };
  const score = scoreNotation([slash, null, null, null], [mixed]);
  assert.deepEqual(
    score[0].staves[1].map((note) => note.name + note.octave),
    ["E2", "E3", "G3"],
  );
  assert.equal(score[0].staves[0].length, 3);
});

test("anchors remain hard constraints in rich presets and rootless rejects a saved root anchor", () => {
  for (const preset of ["right-rich", "left-rich", "both-rich", "rootless"] as const) {
    const result = generate(
      [chord],
      { ...defaults, preset },
      { chordId: 1, tone: 4, rotate: false },
    );
    assert.equal(result.error, undefined);
    assert.equal(mod(result.voices[0].right[0]), 4);
    assert.equal(result.voices[0].bass, 36);
  }
  const anchor = { chordId: 1, tone: 0, rotate: true };
  const options = { ...defaults, preset: "rootless" as const };
  assert.match(generate([chord], options, anchor).error!, /重新选择/);
  assert.deepEqual(nextInversion(anchor, [chord], options), anchor);
  assert.match(
    generate([{ id: 2, root: "C", quality: "7" }], {
      ...defaults,
      low: 60,
      high: 64,
      preset: "both-rich",
    }).error!,
    /没有符合条件/,
  );
});

test("rich progression selection is deterministic and minimizes cost over its retained candidates", () => {
  const progression = [chord, { id: 2, root: "F", quality: "M7", extras: ["9"] }];
  const options = { ...defaults, preset: "both-rich" as const, low: 60, high: 72 };
  const first = generate(progression, options);
  assert.equal(first.error, undefined);
  assert.deepEqual(first, generate(progression, options));
  const layers = progression.map((c) => candidates(c, options));
  let best = Infinity;
  for (const a of layers[0])
    for (const b of layers[1])
      best = Math.min(
        best,
        voicingCost(progression[0], a, options) +
          transition(a, b, "smooth") +
          voicingCost(progression[1], b, options),
      );
  const [a, b] = first.voices;
  assert.ok(
    Math.abs(
      voicingCost(progression[0], a, options) +
        transition(a, b, "smooth") +
        voicingCost(progression[1], b, options) -
        best,
    ) < 1e-8,
  );
});
