import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ChordAudio, soundSettings } from "../src/audio.ts";

function recordingContext() {
  const starts: number[] = [];
  const attacks: { value: number; time: number }[] = [];
  const context = {
    currentTime: 0,
    destination: {},
    createPeriodicWave: () => ({}),
    createDynamicsCompressor: () => ({
      threshold: {},
      knee: {},
      ratio: {},
      attack: {},
      release: {},
      connect() {},
      disconnect() {},
    }),
    createOscillator: () => ({
      frequency: {},
      setPeriodicWave() {},
      connect() {},
      disconnect() {},
      start(time: number) {
        starts.push(time);
      },
      stop() {},
    }),
    createGain: () => {
      let firstRamp = true;
      return {
        connect() {},
        disconnect() {},
        gain: {
          setValueAtTime() {},
          cancelAndHoldAtTime() {},
          linearRampToValueAtTime(value: number, time: number) {
            if (firstRamp) attacks.push({ value, time });
            firstRamp = false;
          },
        },
      };
    },
  };
  return { player: new ChordAudio(context as unknown as BaseAudioContext), starts, attacks };
}

test("each play resamples independent voice timing and volume within the selected limits", (t) => {
  const random = t.mock.method(Math, "random");
  const { player, starts, attacks } = recordingContext();
  const settings = { enabled: true, timingMs: 60, volumePercent: 20 };
  const pitches = [48, 60, 64, 67];
  const peak = soundSettings.level / pitches.length;
  for (const samples of [
    [0.1, 0.2, 0.4, 0.8, 0.1, 0.3, 0.6, 0.9],
    [0.8, 0.1, 0.7, 0.4, 0.2, 0.7, 0.4, 0.6],
  ]) {
    // Distinct deterministic samples make this regression check non-flaky.
    let index = 0;
    random.mock.mockImplementation(() => samples[index++]);
    player.play(pitches, undefined, 1, settings);
  }
  for (let offset = 0; offset < starts.length; offset += pitches.length) {
    const times = starts.slice(offset, offset + pitches.length);
    assert.equal(Math.min(...times), 1);
    assert.ok(Math.max(...times) <= 1.06);
    assert.equal(new Set(times).size, pitches.length);
    const values = attacks.slice(offset, offset + pitches.length);
    assert.equal(new Set(values.map(({ value }) => value)).size, pitches.length);
    values.forEach(({ value, time }, i) => {
      assert.ok(value >= peak * 0.8 && value <= peak * 1.2);
      assert.equal(time, times[i] + soundSettings.attack);
    });
  }
  assert.notDeepEqual(attacks.slice(0, 4), attacks.slice(4));
  assert.notDeepEqual(starts.slice(0, 4), starts.slice(4));
  player.dispose();
});

test("disabled humanization and zero amounts preserve simultaneous equal-volume playback", (t) => {
  t.mock.method(Math, "random", () => {
    throw new Error("unexpected random sample");
  });
  const { player, starts, attacks } = recordingContext();
  for (const settings of [
    undefined,
    { enabled: false, timingMs: 60, volumePercent: 20 },
    { enabled: true, timingMs: 0, volumePercent: 0 },
  ])
    player.play([48, 60, 64], undefined, 2, settings);
  assert.ok(starts.every((time) => time === 2));
  assert.ok(attacks.every(({ value }) => value === soundSettings.level / 3));
  player.dispose();
});

test("an empty chord releases playback without scheduling invalid notes", () => {
  const { player, starts } = recordingContext();
  player.play([]);
  assert.deepEqual(starts, []);
  player.dispose();
});
