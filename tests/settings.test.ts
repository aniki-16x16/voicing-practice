import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  chordSettingsKey,
  globalSettingsKey,
  restoreChordSettings,
  restoreGlobalSettings,
  saveSettings,
} from "../src/settings.ts";

function storage(entries: Record<string, unknown> = {}) {
  const values = new Map(
    Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("every global preference survives saving and restoring independently of chords", () => {
  const cache = storage();
  const value = restoreGlobalSettings(cache);
  value.settings = {
    preset: "both-rich",
    leftMode: "free",
    soloLeft: true,
    movement: "down",
    low: 60,
    high: 84,
    span: 16,
    handLimit: 5,
  };
  value.tempo = 180;
  value.loop = false;
  value.humanization = { enabled: false, timingMs: 45, volumePercent: 12 };
  saveSettings(globalSettingsKey, value, cache);
  assert.deepEqual(restoreGlobalSettings(cache), value);
  assert.equal(cache.getItem(chordSettingsKey), null);
});

test("chord details, sustain slots, and independent top notes restore together", () => {
  const cache = storage();
  const value = {
    beats: [
      { id: 7, root: "Db", quality: "M7", extras: ["9"], bass: "F", reference: "Ab" },
      null,
      { id: 9, root: "G", quality: "7" },
      null,
    ],
    anchors: [
      { chordId: 7, tone: 4, rotate: false },
      { chordId: 9, tone: 10, rotate: true },
    ],
  };
  saveSettings(chordSettingsKey, value, cache);
  assert.deepEqual(restoreChordSettings(cache), value);
  assert.equal(cache.getItem(globalSettingsKey), null);
  saveSettings(chordSettingsKey, { beats: [], anchors: [] }, cache);
  assert.deepEqual(restoreChordSettings(cache), { beats: [], anchors: [] });
});

test("restoration reads only the global and chord snapshots", () => {
  const reads: string[] = [];
  const cache = {
    getItem: (key: string) => {
      reads.push(key);
      return null;
    },
  };
  restoreGlobalSettings(cache);
  restoreChordSettings(cache);
  assert.deepEqual(reads, [globalSettingsKey, chordSettingsKey]);
});

test("invalid caches recover per setting and BPM is rounded and limited to 60–180", () => {
  const defaults = restoreGlobalSettings(storage());
  for (const [tempo, expected] of [
    [40, 60],
    [200, 180],
    [92.6, 93],
    ["fast", 76],
  ]) {
    assert.equal(
      restoreGlobalSettings(storage({ [globalSettingsKey]: { tempo } })).tempo,
      expected,
    );
  }
  const restored = restoreGlobalSettings(
    storage({
      [globalSettingsKey]: {
        settings: { preset: "invalid", movement: "up", low: -1, handLimit: 99 },
        loop: "false",
        humanization: { enabled: false, timingMs: 100, volumePercent: -5 },
      },
    }),
  );
  assert.deepEqual(restored.settings, { ...defaults.settings, movement: "up" });
  assert.equal(restored.loop, true);
  assert.deepEqual(restored.humanization, { enabled: false, timingMs: 60, volumePercent: 0 });
  for (const invalid of [null, {}, "bad", [{ root: "C", quality: "M" }, null, null, null]]) {
    assert.deepEqual(
      restoreChordSettings(storage({ [chordSettingsKey]: { beats: invalid } })),
      restoreChordSettings(storage()),
    );
  }
  assert.deepEqual(restoreGlobalSettings({ getItem: () => "{broken" }), defaults);
  assert.deepEqual(
    restoreGlobalSettings({
      getItem: () => {
        throw new Error("disabled");
      },
    }),
    defaults,
  );
  assert.doesNotThrow(() =>
    saveSettings(globalSettingsKey, defaults, {
      setItem: () => {
        throw new Error("full");
      },
    }),
  );
});
