import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Settings as SettingsIcon,
  Play,
  Pause,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Volume2,
  SkipBack,
  SkipForward,
  Repeat,
} from "lucide-react";
import { DragScroll } from "./DragScroll";
import { ChordAudio } from "./audio";
import {
  chordName,
  chordParts,
  chordQuality,
  baseQualities,
  extraOptions,
  degree,
  generate,
  inversionOptions,
  nextInversion,
  mod,
  noteName,
  qualities,
  referenceAt,
  references,
  pc,
  voicingSpelling,
  voicingPresets,
  omittedNotes,
} from "./music";
import type { Chord, Settings, Voicing, InversionAnchor } from "./music";
import {
  timeline,
  referenceMarkers,
  adjacentChordBeat,
  removeChordAt,
  removeBarAt,
  changeReference,
} from "./practice";
import type { Beat } from "./practice";
import { Select } from "./Select";
import { DegreeSelect } from "./DegreeSelect";
import { TempoControl } from "./TempoControl";
import { DeleteBarButton } from "./DeleteBarButton";
import { Staff } from "./Staff";
import Keyboard from "./Keyboard";
import "./App.css";

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
const defaults: Settings = {
  preset: "basic",
  movement: "smooth",
  low: 48,
  high: 77,
  span: 12,
  handLimit: 4,
};
const emptyChord: Chord = { id: 0, root: "C", quality: "M" };
const validPitch = (note: string) => /^[A-G](?:#+|b+)?$/.test(note);
const validChord = (c: Chord) =>
  c &&
  validPitch(c.root) &&
  Object.hasOwn(qualities, c.quality) &&
  (c.extras === undefined ||
    (Array.isArray(c.extras) &&
      c.extras.every((extra) => extraOptions.some((option) => option.value === extra)))) &&
  (!c.reference || references.includes(c.reference)) &&
  (!c.bass || validPitch(c.bass));
function restore(): Beat[] {
  try {
    const saved = JSON.parse(localStorage.getItem("voicing-practice-v2") || "null");
    if (
      Array.isArray(saved) &&
      saved.length <= 128 &&
      saved.length % 4 === 0 &&
      saved.every((c) => c === null || validChord(c))
    )
      return saved;
    const old = JSON.parse(localStorage.getItem("voicing-practice-v1") || "null");
    if (old?.chords?.length > 0 && old.chords.length <= 32 && old.chords.every(validChord))
      return old.chords.flatMap((c: Chord) => [c, null, null, null]);
  } catch {
    /* Local storage is optional. */
  }
  return initial;
}
const noteOptions = (notes: number[]) =>
  notes.map((n) => ({ value: String(n), label: noteName(n) }));
function Drawer({
  children,
  title,
  navigation,
  label,
  onClose,
}: {
  children: ReactNode;
  title: ReactNode;
  navigation?: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          e.clientX < e.currentTarget.getBoundingClientRect().left
        )
          onClose();
      }}
    >
      <div className="drawer-head">
        <h2>{title}</h2>
        {navigation}
        <button aria-label="关闭抽屉" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [beats, setBeats] = useState<Beat[]>(restore),
    [settings, setSettings] = useState(defaults),
    [current, setCurrent] = useState(0);
  const [anchor, setAnchor] = useState<InversionAnchor | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("voicing-inversion-v1") || "null");
      if (
        saved &&
        beats.some((c) => c?.id === saved.chordId) &&
        Number.isInteger(saved.tone) &&
        typeof saved.rotate === "boolean"
      )
        return saved;
    } catch {
      /* optional */
    }
    return null;
  });
  const [drawer, setDrawer] = useState<"chord" | "practice" | null>(null),
    [tempo, setTempo] = useState(76),
    [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(true),
    [error, setError] = useState(""),
    [cycle, setCycle] = useState(0);
  const audio = useRef<AudioContext | null>(null),
    instrument = useRef<ChordAudio | null>(null),
    soundId = useRef(0),
    lastSound = useRef("");
  const events = useMemo(() => timeline(beats), [beats]),
    result = useMemo(() => generate(events.chords, settings, anchor), [events, settings, anchor]);
  const index = events.indices[current],
    voice = result.voices[index],
    activeChord = events.chords[index],
    chord = activeChord ?? emptyChord,
    reference = referenceAt(events.chords, index);
  const chordSettings = chordParts(chord);
  useEffect(() => {
    try {
      localStorage.setItem("voicing-practice-v2", JSON.stringify(beats));
    } catch {
      /* optional */
    }
  }, [beats]);
  useEffect(() => {
    try {
      localStorage.setItem("voicing-inversion-v1", JSON.stringify(anchor));
    } catch {
      /* optional */
    }
  }, [anchor]);
  const commitBeats = (next: Beat[]) => {
    if (anchor && !next.some((c) => c?.id === anchor.chordId)) setAnchor(null);
    setBeats(next);
  };
  const silence = () => {
    instrument.current?.release();
  };
  const stop = () => {
    soundId.current++;
    setPlaying(false);
    silence();
    lastSound.current = "";
  };
  const pause = () => {
    stop();
    setCurrent(Math.floor(current / 4) * 4);
  };
  const seek = (beat: number) => {
    stop();
    setCurrent(beat);
  };
  const sound = async (v: Voicing, duration: number | null = 1.5) => {
    const request = ++soundId.current;
    try {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      await ctx.resume();
      if (request !== soundId.current) return;
      const player = instrument.current ?? new ChordAudio(ctx);
      instrument.current = player;
      player.play([...v.left, ...v.right], duration ?? undefined);
      setError("");
    } catch {
      setError("音频未能启动，请再次点击试听。");
      stop();
    }
  };
  useEffect(() => {
    if (!playing) return;
    const key = `${cycle}-${index}`;
    if (voice && lastSound.current !== key) {
      lastSound.current = key;
      // 延音持续到实际切换时刻，不因每拍计时器的小幅延迟提前进入尾音。
      void sound(voice, null);
    }
    const timer = window.setTimeout(() => {
      const next = current + 1;
      if (next === beats.length) {
        if (loop) {
          const nextAnchor = nextInversion(anchor, events.chords, settings);
          const nextResult = generate(events.chords, settings, nextAnchor);
          setAnchor(nextAnchor);
          if (nextResult.error) {
            stop();
          }
          setCurrent(0);
          setCycle((n) => n + 1);
        } else {
          stop();
        }
      } else {
        setCurrent(next);
      }
    }, 60000 / tempo);
    return () => window.clearTimeout(timer);
    // The timer advances beats; sustained slots do not retrigger the chord.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, current, tempo, loop, voice, beats.length, cycle, index, events, anchor, settings]);
  useEffect(
    () => () => {
      soundId.current++;
      instrument.current?.dispose();
      instrument.current = null;
      void audio.current?.close();
      audio.current = null;
    },
    [],
  );
  const choose = (beat: number, edit = false) => {
    stop();
    setCurrent(beat);

    if (edit) setDrawer("chord");
  };
  const edit = (patch: Partial<Chord>) => {
    stop();
    // 先建立当前拍的和弦，再以旧调性计算级数，最后移调整段。
    const { reference: nextReference, ...chordPatch } = patch;
    const next = beats.map((c, i) =>
      i === current
        ? {
            ...(c || {
              ...chord,
              id: Math.max(0, ...events.chords.map((x) => x.id)) + 1,
              reference: undefined,
            }),
            ...chordPatch,
          }
        : c,
    );
    commitBeats(
      Object.hasOwn(patch, "reference") ? changeReference(next, current, nextReference) : next,
    );
  };
  const setInversion = (value: string) => {
    stop();
    if (value === "auto") {
      setAnchor(null);
      return;
    }
    let id = beats[current]?.id;
    if (id === undefined) {
      id = Math.max(0, ...events.chords.map((c) => c.id)) + 1;
      commitBeats(
        beats.map((c, i) => (i === current ? { ...chord, id: id!, reference: undefined } : c)),
      );
    }
    const tone =
      value === "rotate"
        ? anchor?.chordId === id &&
          inversionOptions(chord, settings.preset).some((option) => option.tone === anchor.tone)
          ? anchor.tone
          : (inversionOptions(chord, settings.preset).find(
              (option) => voice && mod(option.tone) === mod(voice.right[0] - pc(chord.root)),
            )?.tone ?? 0)
        : Number(value);
    setAnchor({
      chordId: id,
      tone,
      rotate: value === "rotate",
    });
    if (value === "rotate") setLoop(true);
  };
  const configure = (patch: Partial<Settings>) => {
    stop();
    setSettings({ ...settings, ...patch });
  };
  const start = () => {
    setDrawer(null);
    lastSound.current = "";

    setPlaying(true);
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey ||
        drawer ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"]',
          ))
      )
        return;
      event.preventDefault();
      if (event.repeat) return;
      if (playing) pause();
      else if (result.voices.length && !result.error) start();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  const anchorChord = anchor ? events.chords.find((c) => c.id === anchor.chordId) : undefined;
  const anchorName =
    anchor && anchorChord
      ? inversionOptions(anchorChord, settings.preset).find((o) => o.tone === anchor.tone)?.name ||
        "需重选转位"
      : "";
  const isAnchor = !!beats[current] && anchor?.chordId === beats[current]?.id;
  const markers = useMemo(() => referenceMarkers(beats), [beats]);
  const addBar = () => {
    if (beats.length >= 128) return;
    stop();
    commitBeats([...beats, null, null, null, null]);
    setCurrent(beats.length);
  };
  const deleteChord = (beat: number) => {
    stop();
    commitBeats(removeChordAt(beats, beat));
  };
  const currentBar = Math.floor(current / 4);
  const emptyBar = beats.slice(currentBar * 4, currentBar * 4 + 4).every((chord) => !chord);
  const deleteBar = () => {
    stop();
    const next = removeBarAt(beats, currentBar);
    commitBeats(next);
    setCurrent(Math.min(currentBar * 4, Math.max(0, next.length - 4)));
    if (!next.length) setDrawer(null);
  };
  const symbol = (c: Chord, ref: string) => (
    <>
      {degree(c.root, ref)}
      <sup>{chordQuality(c)}</sup>
      {c.bass && <small>/{degree(c.bass, ref)}</small>}
    </>
  );
  return (
    <div className="app">
      <header className="toolbar">
        <button
          className="icon-button"
          aria-label="设置"
          title="设置"
          onClick={() => {
            stop();
            setDrawer("practice");
          }}
        >
          <SettingsIcon size={20} />
        </button>
      </header>
      <main className="practice">
        <section className="progression" aria-label="和弦进行">
          <DragScroll
            label="和弦进行，左右拖动浏览"
            className="chord-rail"
            followKey={Math.floor(current / 4)}
            onDeleteChord={deleteChord}
          >
            <div className="measures">
              {Array.from({ length: beats.length / 4 }, (_, bar) => (
                <div className="measure" key={bar} data-follow={bar}>
                  {[0, 1, 2, 3].map((b) => {
                    const beat = bar * 4 + b,
                      c = beats[beat],
                      ref = referenceAt(events.chords, events.indices[beat]);
                    return (
                      <div className="beat-slot" key={beat}>
                        {markers[beat] && (
                          <span className="reference-marker">{markers[beat]} 大调</span>
                        )}
                        <button
                          className={`beat ${current === beat ? "active" : ""} ${c ? "has-chord" : ""} ${c && anchor?.chordId === c.id ? "inversion-set" : ""}`}
                          aria-label={`第${bar + 1}小节第${b + 1}拍 ${c ? chordName(c) : "延续"}，点击编辑`}
                          aria-pressed={current === beat}
                          data-delete-beat={c ? beat : undefined}
                          onClick={() => choose(beat, !playing)}
                          title={c ? `${chordName(c)} · 长按后拖动删除` : "延续前一个和弦"}
                        >
                          <strong>{c ? symbol(c, ref) : "—"}</strong>
                        </button>
                        {c && (
                          <span className="chord-name" title={chordName(c)}>
                            {chordName(c)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <button
                className="add-measure icon-button"
                aria-label="添加小节"
                title="添加小节"
                disabled={beats.length >= 128}
                onClick={addBar}
              >
                <Plus size={20} />
              </button>
            </div>
          </DragScroll>
        </section>
        <section className="notation" aria-label="五线谱">
          {result.error ? (
            <div role="alert" className="error">
              {result.error}
              <button onClick={() => setDrawer("practice")}>调整设置</button>
            </div>
          ) : (
            <Staff
              beats={beats}
              voices={result.voices}
              current={current}
              onSelect={(beat) => choose(beat)}
            />
          )}
        </section>
        <section className="keys-section">
          <div className="keyboard-heading">
            <h2>
              {activeChord ? (
                <>
                  {symbol(chord, reference)}
                  <small>{chordName(chord)}</small>
                </>
              ) : (
                "休止"
              )}
            </h2>
            <div className="note-chips">
              {voice &&
                [...voice.left, ...voice.right].map((n, i) => {
                  const s = voicingSpelling(n, chord, voice);
                  return (
                    <span className={i < voice.left.length ? "bass-chip" : ""} key={`${n}-${i}`}>
                      {s.name}
                      {s.octave}
                    </span>
                  );
                })}
            </div>
            <button
              className="audition icon-button"
              aria-label="试听当前和弦"
              title="试听当前和弦"
              disabled={!voice}
              onClick={() => {
                stop();
                if (voice) void sound(voice);
              }}
            >
              <Volume2 size={16} />
            </button>
          </div>
          {voice && (
            <div className="voicing-summary" aria-label="当前排列选音">
              <span>
                左手 {voice.left.length} 音 · 右手 {voice.right.length} 音
              </span>
              {omittedNotes(chord, voice).length > 0 && (
                <span>省略：{omittedNotes(chord, voice).join("、")}</span>
              )}
            </div>
          )}
          <Keyboard voice={voice} chord={chord} />
        </section>
        <div className="transport">
          <button
            className="icon-button"
            aria-label="回到开头"
            title="回到开头"
            disabled={!beats.length}
            onClick={() => seek(0)}
          >
            <SkipBack size={20} />
          </button>
          <button
            className="play icon-button"
            aria-label={playing ? "暂停" : "播放"}
            title={playing ? "暂停（空格）" : "播放（空格）"}
            aria-keyshortcuts="Space"
            disabled={!result.voices.length || !!result.error}
            onClick={() => (playing ? pause() : start())}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            className="icon-button"
            aria-label="回到结尾"
            title="回到结尾"
            disabled={!beats.length}
            onClick={() => seek(beats.length - 1)}
          >
            <SkipForward size={20} />
          </button>
          <button
            className={`loop-toggle icon-button ${loop ? "enabled" : ""}`}
            aria-label="循环播放"
            aria-pressed={loop}
            title={loop ? "关闭循环播放" : "开启循环播放"}
            onClick={() => setLoop((value) => !value)}
          >
            <Repeat size={19} />
          </button>
          <div className="playback-tempo">
            <TempoControl value={tempo} onChange={setTempo} />
          </div>
        </div>
        {error && (
          <p className="audio-error" role="alert">
            {error}
          </p>
        )}
      </main>
      {drawer && (
        <Drawer
          onClose={() => setDrawer(null)}
          label={drawer === "chord" ? "和弦编辑" : "练习设置"}
          title={
            drawer === "chord"
              ? `第 ${Math.floor(current / 4) + 1} 小节 · 第 ${(current % 4) + 1} 拍`
              : "练习设置"
          }
          navigation={
            drawer === "chord" ? (
              <div className="drawer-navigation">
                <button
                  className="icon-button"
                  aria-label="编辑上一个和弦"
                  disabled={!events.chords.length}
                  onClick={() => choose(adjacentChordBeat(beats, current, -1), true)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="编辑下一个和弦"
                  disabled={!events.chords.length}
                  onClick={() => choose(adjacentChordBeat(beats, current, 1), true)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : undefined
          }
        >
          <div className="drawer-content" data-select-container>
            {drawer === "chord" ? (
              <>
                <p className="hint">
                  {beats[current]
                    ? "此拍开始新的和弦。"
                    : activeChord
                      ? "此拍延续前一个和弦；选择后会在此拍加入和弦。"
                      : "此拍休止；选择后会在此拍加入和弦。"}
                </p>
                <DegreeSelect
                  label="根音级数"
                  note={chord.root}
                  reference={reference}
                  onChange={(root) => edit({ root })}
                />
                <div className="field-row chord-quality-row">
                  <Select
                    label="基础和弦"
                    layout="tags"
                    value={chordSettings.base}
                    options={baseQualities}
                    onChange={(quality) => edit({ quality, extras: chordSettings.extras })}
                  />
                  <Select
                    label="附加音"
                    layout="tags"
                    value={chordSettings.extras}
                    options={extraOptions}
                    multiple
                    onChange={(extras) => edit({ quality: chordSettings.base, extras })}
                  />
                </div>
                <DegreeSelect
                  label="低音级数"
                  note={chord.bass || chord.root}
                  reference={reference}
                  onChange={(bass) => edit({ bass: bass === chord.root ? undefined : bass })}
                />
                <Select
                  label="分段参照大调"
                  layout="tags"
                  value={beats[current]?.reference || (current === 0 ? "C" : "")}
                  options={[
                    ...(current > 0 ? [{ value: "", label: "沿用前段" }] : []),
                    ...references.map((r) => ({ value: r, label: r + " 大调" })),
                  ]}
                  onChange={(reference) => edit({ reference: reference || undefined })}
                />
                <p className="hint">切换调性保留本段根音、低音级数，直到下一个明确的调性标记。</p>
                <section className="inversion-settings" aria-label="右手转位设置">
                  <Select
                    label="右手转位"
                    value={isAnchor ? (anchor!.rotate ? "rotate" : String(anchor!.tone)) : "auto"}
                    options={[
                      { value: "auto", label: "自动优化" },
                      { value: "rotate", label: "每轮自动换转位" },
                      ...inversionOptions(chord, settings.preset).map((o) => ({
                        value: String(o.tone),
                        label: o.label,
                      })),
                      ...(isAnchor &&
                      !inversionOptions(chord, settings.preset).some((o) => o.tone === anchor!.tone)
                        ? [{ value: String(anchor!.tone), label: "原转位不可用，请重选" }]
                        : []),
                    ]}
                    onChange={setInversion}
                  />
                  {isAnchor && anchor?.rotate && (
                    <p className="hint">
                      整段循环结束后切换；无解时暂停，不跳过。
                      {!loop && "当前循环播放已关闭，自动切换不会执行。"}
                    </p>
                  )}
                  {!isAnchor && anchorChord && (
                    <p className="hint">
                      当前锚点：{chordName(anchorChord)} · {anchorName}
                      <button className="clear-anchor" onClick={() => setInversion("auto")}>
                        解除
                      </button>
                    </p>
                  )}
                </section>
                <div className="edit-preview">
                  <strong>{symbol(chord, reference)}</strong>
                  <span>{chordName(chord)}</span>
                </div>
              </>
            ) : (
              <>
                <Select
                  label="Voicing 预设"
                  value={settings.preset}
                  options={[...voicingPresets]}
                  onChange={(preset) => configure({ preset: preset as Settings["preset"] })}
                />
                <p className="hint">
                  {voicingPresets.find((preset) => preset.value === settings.preset)?.description}
                </p>
                <Select
                  label="单手音数上限"
                  value={String(settings.handLimit)}
                  options={[
                    { value: "4", label: "4 音" },
                    { value: "5", label: "5 音" },
                  ]}
                  onChange={(value) => configure({ handLimit: Number(value) as 4 | 5 })}
                />
                <Select
                  label="连接目标"
                  value={settings.movement}
                  options={[
                    { value: "smooth", label: "平稳连接" },
                    { value: "up", label: "最高声部倾向上行" },
                    { value: "down", label: "最高声部倾向下行" },
                  ]}
                  onChange={(movement) => configure({ movement: movement as Settings["movement"] })}
                />
                <div className="field-row">
                  <Select
                    label="右手最低音"
                    value={String(settings.low)}
                    options={noteOptions([48, 53, 55, 60])}
                    onChange={(low) => configure({ low: Number(low) })}
                  />
                  <Select
                    label="右手最高音"
                    value={String(settings.high)}
                    options={noteOptions([72, 77, 79, 84])}
                    onChange={(high) => configure({ high: Number(high) })}
                  />
                </div>
                <Select
                  label="双手最大跨度"
                  value={String(settings.span)}
                  options={[
                    { value: "12", label: "八度 · 12 半音" },
                    { value: "14", label: "九度 · 14 半音" },
                    { value: "16", label: "十度 · 16 半音" },
                  ]}
                  onChange={(span) => configure({ span: Number(span) })}
                />
                <p className="hint">
                  音数与跨度分别限制每只手，左手低音也计入；音区和低音清晰度会共同影响选音。
                </p>
                <div className="tempo-control">
                  <span>播放速度</span>
                  <TempoControl value={tempo} onChange={setTempo} />
                  <p className="hint">点击加减微调，或直接输入；按住 Shift 每次调整 5 BPM。</p>
                </div>
                <label className="loop-control">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                  循环播放
                </label>
              </>
            )}
          </div>
          <div className="drawer-bottom">
            {drawer === "chord" && (
              <DeleteBarButton key={currentBar} empty={emptyBar} onDelete={deleteBar} />
            )}
            <button className="primary" onClick={() => setDrawer(null)}>
              完成编辑
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
export default App;
