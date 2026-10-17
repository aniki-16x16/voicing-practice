import { defaultHumanization } from "./audio.ts";
import type { HumanizationSettings } from "./audio.ts";
import { extraOptions, qualities, references, voicingPresets } from "./music.ts";
import type { Chord, Settings, TopNoteAnchor } from "./music.ts";
import { restoreTopNotes } from "./practice.ts";
import type { Beat } from "./practice.ts";

export const minimumTempo = 60;
export const maximumTempo = 180;
export const globalSettingsKey = "voicing-global-settings-v1";
export const chordSettingsKey = "voicing-chord-settings-v1";

export interface GlobalSettings {
  settings: Settings;
  tempo: number;
  loop: boolean;
  humanization: HumanizationSettings;
}
export interface ChordSettings {
  beats: Beat[];
  anchors: TopNoteAnchor[];
}
const defaults: Settings = {
  preset: "shell",
  leftMode: "root",
  soloLeft: false,
  movement: "smooth",
  low: 48,
  high: 77,
  span: 12,
  handLimit: 4,
};
const initial: Beat[] = [
  { id: 1, root: "D", quality: "m7", reference: "C" },
  null,
  null,
  null,
  { id: 2, root: "G", quality: "7" },
  null,
  null,
  null,
  { id: 3, root: "C", quality: "M7" },
  null,
  null,
  null,
  { id: 4, root: "A", quality: "m7" },
  null,
  null,
  null,
];
type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
function read(storage: StorageReader, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function option<T>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}
function integer(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.max(min, Math.min(max, value)))
    : fallback;
}
function boolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
export function restoreGlobalSettings(storage: StorageReader): GlobalSettings {
  const saved = record(read(storage, globalSettingsKey));
  const settings = record(saved.settings);
  const humanization = record(saved.humanization);
  return {
    settings: {
      preset: option(
        settings.preset,
        voicingPresets.map(({ value }) => value),
        defaults.preset,
      ),
      leftMode: option(settings.leftMode, ["root", "shell", "free"] as const, defaults.leftMode!),
      soloLeft: boolean(settings.soloLeft, defaults.soloLeft!),
      movement: option(settings.movement, ["smooth", "up", "down"] as const, defaults.movement),
      low: option(settings.low, [48, 53, 55, 60], defaults.low),
      high: option(settings.high, [72, 77, 79, 84], defaults.high),
      span: option(settings.span, [12, 14, 16], defaults.span),
      handLimit: option(settings.handLimit, [4, 5] as const, defaults.handLimit),
    },
    tempo: integer(saved.tempo, minimumTempo, maximumTempo, 76),
    loop: boolean(saved.loop, true),
    humanization: {
      enabled: boolean(humanization.enabled, defaultHumanization.enabled),
      timingMs: integer(humanization.timingMs, 0, 60, defaultHumanization.timingMs),
      volumePercent: integer(humanization.volumePercent, 0, 20, defaultHumanization.volumePercent),
    },
  };
}
const validPitch = (note: unknown): note is string =>
  typeof note === "string" && /^[A-G](?:#+|b+)?$/.test(note);
function validChord(value: unknown): value is Chord {
  const chord = record(value);
  return (
    Number.isInteger(chord.id) &&
    Number(chord.id) > 0 &&
    validPitch(chord.root) &&
    typeof chord.quality === "string" &&
    Object.hasOwn(qualities, chord.quality) &&
    (chord.extras === undefined ||
      (Array.isArray(chord.extras) &&
        chord.extras.every((extra) => extraOptions.some((option) => option.value === extra)))) &&
    (chord.reference === undefined || references.includes(chord.reference as string)) &&
    (chord.bass === undefined || validPitch(chord.bass))
  );
}
function validBeats(value: unknown): value is Beat[] {
  if (
    !Array.isArray(value) ||
    value.length > 128 ||
    value.length % 4 !== 0 ||
    !value.every((chord) => chord === null || validChord(chord))
  )
    return false;
  const ids = value.flatMap((chord) => (chord ? [chord.id] : []));
  return new Set(ids).size === ids.length;
}
export function restoreChordSettings(storage: StorageReader): ChordSettings {
  const saved = record(read(storage, chordSettingsKey));
  return validBeats(saved.beats)
    ? { beats: saved.beats, anchors: restoreTopNotes(saved.anchors, saved.beats) }
    : { beats: initial, anchors: [] };
}
export function restoreSavedSettings() {
  let storage: StorageReader;
  try {
    storage = localStorage;
  } catch {
    storage = { getItem: () => null };
  }
  return { global: restoreGlobalSettings(storage), chords: restoreChordSettings(storage) };
}
export function saveSettings(
  key: string,
  value: GlobalSettings | ChordSettings,
  storage?: StorageWriter,
) {
  try {
    (storage ?? localStorage).setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or disabled; settings still work for the current session.
  }
}
