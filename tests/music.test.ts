import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  candidates,
  chordIntervals,
  chordName,
  chordParts,
  degree,
  generate,
  nextTopNote,
  nextTopNotes,
  topNoteOptions,
  mod,
  pc,
  qualities,
  roots,
  rootAtDegree,
  references,
  selectedIntervals,
  spelling,
  transition,
  omittedNotes,
} from "../src/music.ts";
import type { Chord, Settings } from "../src/music.ts";

test("a middle chord anchor fixes the top note and leaves left bass alone", () => {
  for (const preset of ["basic", "shell"] as const)
    for (const tone of selectedIntervals(chords[1], preset)) {
      const options = { ...settings, preset };
      const anchor = { chordId: 2, tone, rotate: false };
      const r = generate(chords, options, anchor);
      assert.equal(r.error, undefined);
      assert.equal(mod(r.voices[1].right.at(-1)!), mod(pc("G") + tone));
      assert.equal(r.voices[1].bass, 43);
      assert.deepEqual(r, generate(chords, options, anchor));
    }
});
test("a single anchor still works and clearing restores free generation", () => {
  const r = generate(chords, settings, { chordId: 3, tone: 7, rotate: false });
  assert.equal(mod(r.voices[2].right.at(-1)!), 7);
  assert.deepEqual(generate(chords, settings, null), generate(chords, settings));
});

test("adjacent fixed top notes survive a conflicting movement preference", () => {
  const progression = [
    { id: 1, root: "C", quality: "M" },
    { id: 2, root: "C", quality: "M" },
  ];
  const anchors = [
    { chordId: 1, tone: 0, rotate: false },
    { chordId: 2, tone: 7, rotate: false },
  ];
  const options = { ...settings, low: 60, high: 72, movement: "up" as const };
  const result = generate(progression, options, anchors);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(
    result.voices.map((v) => v.right.at(-1)),
    [72, 67],
  );
  assert.deepEqual(generate(progression, options, []), generate(progression, options));
  const one = generate(progression, options, anchors.slice(1));
  assert.equal(one.error, undefined);
  assert.equal(one.voices[1].right.at(-1), 67);
  assert.deepEqual(
    anchors.map((anchor) => anchor.tone),
    [0, 7],
  );
});

test("every impossible chord is reported without marking valid fixed chords", () => {
  const progression = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, root: "C", quality: "M" }));
  const anchors = [
    { chordId: 1, tone: 0, rotate: false },
    { chordId: 2, tone: 0, rotate: true },
    { chordId: 3, tone: 1, rotate: false },
    { chordId: 4, tone: 7, rotate: false },
  ];
  const options = { ...settings, low: 60, high: 67 };
  const result = generate(progression, options, anchors);
  assert.deepEqual(result.voices, []);
  assert.deepEqual(Object.keys(result.errors), ["1", "2", "3"]);
  assert.match(result.errors[1], /第 1 个和弦.*指定最高音/);
  assert.match(result.errors[2], /第 2 个和弦.*指定最高音/);
  assert.match(result.errors[3], /重新选择最高音/);
  const repaired = generate(progression, options, [anchors[3]]);
  assert.equal(repaired.error, undefined);
  assert.deepEqual(repaired.errors, {});
});

test("multiple rotating top notes advance independently while fixed ones stay fixed", () => {
  const anchors = [
    { chordId: 1, tone: 0, rotate: true },
    { chordId: 2, tone: 4, rotate: false },
    { chordId: 3, tone: 11, rotate: true },
    { chordId: 99, tone: 0, rotate: true },
  ];
  for (const soloLeft of [false, true]) {
    const next = nextTopNotes(anchors, chords, { ...settings, soloLeft });
    assert.deepEqual(next, [
      { chordId: 1, tone: 3, rotate: true },
      anchors[1],
      { chordId: 3, tone: 0, rotate: true },
    ]);
    const result = generate(chords, { ...settings, soloLeft }, next);
    assert.equal(result.error, undefined);
    result.voices.forEach((v, i) => {
      assert.equal(mod((soloLeft ? v.left : v.right).at(-1)! - pc(chords[i].root)), next[i].tone);
    });
  }
  assert.equal(anchors[0].tone, 0);
  assert.deepEqual(nextTopNotes([], chords, settings), []);
});
test("rotation covers every selected top tone, wraps, and never skips an impossible tone", () => {
  const chord = { id: 1, root: "C", quality: "M" };
  const options = { ...settings, low: 60, high: 67 };
  let a = { chordId: 1, tone: 7, rotate: true };
  assert.equal(generate([chord], options, a).error, undefined);
  a = nextTopNote(a, [chord], options)!;
  assert.equal(a.tone, 0);
  assert.match(generate([chord], options, a).error!, /指定最高音/);
  a = nextTopNote(a, [chord], options)!;
  assert.equal(a.tone, 4);
  a = nextTopNote(a, [chord], options)!;
  assert.equal(a.tone, 7);
  assert.equal(nextTopNote({ ...a, rotate: false }, [chord], options)?.tone, 7);
  assert.equal(nextTopNote(a, [], options), null);
});
test("removed tones report an error rather than silently changing the constraint", () => {
  const a = { chordId: 2, tone: 7, rotate: true };
  const options = { ...settings, preset: "shell" as const };
  assert.match(generate(chords, options, a).error!, /重新选择/);
  assert.deepEqual(nextTopNote(a, chords, options), a);
  assert.equal(topNoteOptions(chords[1], { preset: "basic" })[1].label, "3 音");
  assert.equal(topNoteOptions(chords[1], { preset: "shell" })[2].label, "7 音");
});

test("top note labels show only chord tone numbers, including extensions", () => {
  const labels = (quality: string, extras?: string[]) =>
    topNoteOptions({ id: 1, root: "C", quality, extras }, { preset: "basic" }).map((o) => o.label);
  assert.deepEqual(labels("m7"), ["1 音", "3 音", "5 音", "7 音"]);
  assert.deepEqual(labels("dim7"), ["1 音", "3 音", "5 音", "7 音"]);
  assert.deepEqual(labels("7", ["#9", "#11", "b13"]), [
    "1 音",
    "3 音",
    "5 音",
    "7 音",
    "9 音",
    "11 音",
    "13 音",
  ]);
});
const settings: Settings = {
  preset: "basic",
  movement: "smooth",
  low: 48,
  high: 77,
  span: 12,
  handLimit: 4,
};
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
      for (const preset of ["basic", "shell"] as const) {
        const chord = { id: 1, root, quality },
          options = { ...settings, preset, span: 16, high: 84 };
        const { voices, error } = generate([chord], options);
        assert.equal(error, undefined, root + quality);
        const v = voices[0];
        assert.equal(v.bass, 36 + pc(root));
        assert.ok(v.right[0] >= options.low);
        assert.ok(v.right.at(-1)! <= options.high);
        assert.ok(v.right.at(-1)! - v.right[0] <= options.span);
        const played = v.right.map((n) => mod(n - pc(root)));
        const parts = chordParts(chord);
        const required =
          preset === "shell"
            ? selectedIntervals(chord, preset)
            : chordIntervals({
                ...chord,
                quality: parts.base,
                extras: parts.extras.filter((extra) => extra.startsWith("sus")),
              });
        assert.ok(required.every((tone) => played.includes(mod(tone))));
        assert.ok(
          played.every((tone) =>
            selectedIntervals(chord, preset)
              .map((n) => mod(n))
              .includes(tone),
          ),
        );
        assert.ok(v.right.length <= options.handLimit);
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

test("degree editing keeps the reference scale spelling, including altered degrees", () => {
  assert.equal(rootAtDegree(3, "D"), "F#");
  assert.equal(rootAtDegree(7, "F#"), "E#");
  assert.equal(rootAtDegree(7, "F#", 1), "E##");
  assert.equal(rootAtDegree(1, "Db", -1), "Dbb");
  assert.equal(rootAtDegree(5, "C", -1), "Gb");
  for (const reference of references)
    for (let value = 1; value <= 7; value++)
      for (const alteration of [-1, 0, 1])
        assert.equal(
          degree(rootAtDegree(value, reference, alteration), reference),
          `${alteration === -1 ? "b" : alteration === 1 ? "#" : ""}${value}`,
        );
});

test("legacy chord qualities split into the new editor without changing their tones or names", () => {
  for (const quality of ["M9", "m9", "9", "sus2", "sus4", "7sus4", "Madd9", "7(b9)", "7(#5,b9)"]) {
    const old = { id: 1, root: "C", quality, bass: "E" };
    const { base, extras } = chordParts(old);
    const edited = { ...old, quality: base, extras };
    assert.deepEqual(chordIntervals(edited), qualities[quality]);
    assert.equal(chordName(edited), "C" + quality + "/E");
  }
});

test("multiple extensions affect voicing and staff spelling, while shell keeps the core", () => {
  const chord = { id: 1, root: "C", quality: "7", extras: ["9", "#11", "13"] };
  assert.deepEqual(selectedIntervals(chord, "basic"), [0, 4, 7, 10, 14, 18, 21]);
  assert.deepEqual(selectedIntervals(chord, "shell"), [0, 4, 10]);
  assert.equal(spelling(62, chord).name, "D");
  assert.equal(spelling(66, chord).name, "F#");
  assert.equal(spelling(69, chord).name, "A");
  const { voices, error } = generate([chord], settings);
  assert.equal(error, undefined);
  assert.deepEqual(
    voices[0].right.map((pitch) => mod(pitch)).sort((a, b) => a - b),
    [0, 4, 7, 10],
  );
  assert.deepEqual(omittedNotes(chord, voices[0]), ["D", "F#", "A"]);
  assert.equal(spelling(63, { ...chord, extras: ["#9"] }).name, "D#");
  assert.equal(spelling(68, { ...chord, extras: ["b13"] }).name, "Ab");
});

test("suspensions replace thirds and duplicate extra pitch classes do not create impossible voices", () => {
  const suspended = { id: 1, root: "C", quality: "m7", extras: ["sus2", "sus4", "9"] };
  assert.deepEqual(selectedIntervals(suspended, "basic"), [0, 2, 5, 7, 10]);
  assert.deepEqual(selectedIntervals(suspended, "shell"), [0, 2, 5, 10]);
  const six = { id: 2, root: "C", quality: "M", extras: ["6", "13"] };
  assert.deepEqual(chordIntervals(six), [0, 4, 7, 9]);
  assert.equal(spelling(69, six).name, "A");
  assert.match(generate([suspended, six], settings).error!, /单手音数上限/);
  assert.equal(generate([suspended, six], { ...settings, handLimit: 5 }).error, undefined);
  assert.equal(spelling(69, { id: 3, root: "C", quality: "dim7" }).name, "Bbb");
});
