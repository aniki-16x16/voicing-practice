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
  Anchor,
  SkipBack,
  SkipForward,
  Repeat,
} from "lucide-react";
import { DragScroll } from "./DragScroll";
import { ChordAudio } from "./audio";
import {
  chordName,
  degree,
  generate,
  inversionOptions,
  nextInversion,
  mod,
  noteName,
  qualities,
  referenceAt,
  references,
  roots,
  spelling,
} from "./music";
import type { Chord, Settings, Voicing, InversionAnchor } from "./music";
import { timeline, referenceMarkers } from "./practice";
import type { Beat } from "./practice";
import { Select } from "./Select";
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
const defaults: Settings = { preset: "full", movement: "smooth", low: 48, high: 77, span: 12 };
const validChord = (c: Chord) =>
  c &&
  roots.includes(c.root) &&
  Object.hasOwn(qualities, c.quality) &&
  (!c.reference || references.includes(c.reference)) &&
  (!c.bass || roots.includes(c.bass));
function restore(): Beat[] {
  try {
    const saved = JSON.parse(localStorage.getItem("voicing-practice-v2") || "null");
    if (
      Array.isArray(saved) &&
      saved.length > 0 &&
      saved.length <= 128 &&
      saved.length % 4 === 0 &&
      saved[0] &&
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
const opts = (values: string[]) => values.map((value) => ({ value, label: value }));
const noteOptions = (notes: number[]) =>
  notes.map((n) => ({ value: String(n), label: noteName(n) }));
function Drawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
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
      aria-label="编辑与设置"
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
        <h2>编辑与设置</h2>
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
    chord = events.chords[index],
    reference = referenceAt(events.chords, index);
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
      player.play([v.bass, ...v.right], duration ?? undefined);
      setError("");
    } catch {
      setError("音频未能启动，请再次点击试听。");
      stop();
    }
  };
  useEffect(() => {
    if (!playing || !voice) return;
    const key = `${cycle}-${index}`;
    if (lastSound.current !== key) {
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
    else if (result.voices[events.indices[beat]]) void sound(result.voices[events.indices[beat]]);
  };
  const edit = (patch: Partial<Chord>) => {
    stop();
    commitBeats(
      beats.map((c, i) =>
        i === current
          ? {
              ...(c || {
                ...chord,
                id: Math.max(...events.chords.map((x) => x.id)) + 1,
                reference: undefined,
              }),
              ...patch,
            }
          : c,
      ),
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
      id = Math.max(...events.chords.map((c) => c.id)) + 1;
      commitBeats(
        beats.map((c, i) => (i === current ? { ...chord, id: id!, reference: undefined } : c)),
      );
    }
    setAnchor({
      chordId: id,
      tone: Number(value),
      rotate: anchor?.chordId === id ? anchor.rotate : false,
    });
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
  const symbol = (c: Chord, ref: string) => (
    <>
      {degree(c.root, ref)}
      <sup>{c.quality}</sup>
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
                          className={`beat ${current === beat ? "active" : ""} ${c ? "has-chord" : ""}`}
                          aria-label={`第${bar + 1}小节第${b + 1}拍 ${c ? chordName(c) : "延续"}，点击编辑`}
                          aria-pressed={current === beat}
                          onClick={() => choose(beat, !playing)}
                          title={c ? chordName(c) : "延续前一个和弦"}
                        >
                          <strong>{c ? symbol(c, ref) : "—"}</strong>
                          {c && anchor?.chordId === c.id && (
                            <span
                              className="anchor-marker"
                              title={anchorName}
                              aria-label={`转位锚点：${anchorName}`}
                            >
                              <Anchor size={10} />
                              {anchorName}
                            </span>
                          )}
                        </button>
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
              {symbol(chord, reference)}
              <small>{chordName(chord)}</small>
            </h2>
            <div className="note-chips">
              {voice &&
                [voice.bass, ...voice.right].map((n, i) => {
                  const s = spelling(n, chord, i === 0);
                  return (
                    <span className={i === 0 ? "bass-chip" : ""} key={`${n}-${i}`}>
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
          <Keyboard voice={voice} chord={chord} />
        </section>
        <div className="transport">
          <button
            className="icon-button"
            aria-label="回到开头"
            title="回到开头"
            onClick={() => seek(0)}
          >
            <SkipBack size={20} />
          </button>
          <button
            className="play icon-button"
            aria-label={playing ? "暂停" : "播放"}
            title={playing ? "暂停" : "播放"}
            disabled={!voice}
            onClick={() => (playing ? pause() : start())}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            className="icon-button"
            aria-label="回到结尾"
            title="回到结尾"
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
          <span className="playback-info">
            {tempo} <small>BPM</small>
          </span>
        </div>
        {error && (
          <p className="audio-error" role="alert">
            {error}
          </p>
        )}
      </main>
      {drawer && (
        <Drawer onClose={() => setDrawer(null)}>
          <div className="drawer-tabs">
            <button
              className={drawer === "chord" ? "selected" : ""}
              onClick={() => setDrawer("chord")}
            >
              当前拍
            </button>
            <button
              className={drawer === "practice" ? "selected" : ""}
              onClick={() => setDrawer("practice")}
            >
              练习设置
            </button>
          </div>
          <div className="drawer-content">
            {drawer === "chord" ? (
              <>
                <div className="edit-title">
                  <h3>
                    第 {Math.floor(current / 4) + 1} 小节 · 第 {(current % 4) + 1} 拍
                  </h3>
                  <div>
                    <button
                      aria-label="编辑上一拍"
                      onClick={() => choose(mod(current - 1, beats.length), true)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      aria-label="编辑下一拍"
                      onClick={() => choose((current + 1) % beats.length, true)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
                <p className="hint">
                  {beats[current]
                    ? "此拍开始新的和弦。"
                    : "此拍延续前一个和弦；选择后会在此拍加入和弦。"}
                </p>
                <div className="field-row">
                  <Select
                    label="根音"
                    value={chord.root}
                    options={opts(roots)}
                    onChange={(root) => edit({ root })}
                  />
                  <Select
                    label="性质"
                    value={chord.quality}
                    options={opts(Object.keys(qualities))}
                    onChange={(quality) => edit({ quality })}
                  />
                </div>
                <Select
                  label="左手低音"
                  value={chord.bass || ""}
                  options={[{ value: "", label: "根音" }, ...opts(roots)]}
                  onChange={(bass) => edit({ bass: bass || undefined })}
                />
                <Select
                  label="分段参照大调"
                  value={beats[current]?.reference || (current === 0 ? "C" : "")}
                  options={[
                    ...(current > 0 ? [{ value: "", label: "沿用前段" }] : []),
                    ...references.map((r) => ({ value: r, label: r + " 大调" })),
                  ]}
                  onChange={(reference) => edit({ reference: reference || undefined })}
                />
                <section className="inversion-settings" aria-label="右手转位设置">
                  <Select
                    label="右手转位"
                    value={isAnchor ? String(anchor!.tone) : "auto"}
                    options={[
                      { value: "auto", label: "自动" },
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
                  <p className="hint">
                    右手最低音决定转位，左手低音不变。指定后会替换其他和弦的转位锚点。
                  </p>
                  <label className="loop-control">
                    <input
                      type="checkbox"
                      disabled={!isAnchor}
                      checked={isAnchor && !!anchor?.rotate}
                      onChange={(e) => {
                        stop();
                        if (anchor) setAnchor({ ...anchor, rotate: e.target.checked });
                        if (e.target.checked) setLoop(true);
                      }}
                    />
                    每轮自动切换转位
                  </label>
                  {isAnchor && anchor?.rotate && (
                    <p className="hint">
                      整段循环结束后切换；无解时暂停，不跳过。
                      {!loop && "当前循环播放已关闭，自动切换不会执行。"}
                    </p>
                  )}
                  {!isAnchor && anchorChord && (
                    <p className="hint">
                      当前锚点：{chordName(anchorChord)} · {anchorName}
                      <button
                        className="clear-anchor"
                        onClick={() => {
                          stop();
                          setAnchor(null);
                        }}
                      >
                        解除
                      </button>
                    </p>
                  )}
                </section>
                <div className="edit-preview">
                  <strong>{symbol(chord, reference)}</strong>
                  <span>{chordName(chord)}</span>
                </div>
                <button className="wide" onClick={() => edit({})}>
                  在此拍{beats[current] ? "保留" : "加入"} {chordName(chord)}
                </button>
                <button
                  className="wide subtle"
                  disabled={current === 0 || !beats[current]}
                  onClick={() => {
                    stop();
                    commitBeats(beats.map((c, i) => (i === current ? null : c)));
                  }}
                >
                  清除此拍，延续前一个和弦
                </button>
              </>
            ) : (
              <>
                <Select
                  label="Voicing 预设"
                  value={settings.preset}
                  options={[
                    { value: "full", label: "完整和弦" },
                    { value: "shell", label: "Shell 骨架" },
                  ]}
                  onChange={(preset) => configure({ preset: preset as Settings["preset"] })}
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
                  label="右手最大跨度"
                  value={String(settings.span)}
                  options={[
                    { value: "7", label: "纯五度 · 7 半音" },
                    { value: "12", label: "八度 · 12 半音" },
                    { value: "14", label: "九度 · 14 半音" },
                    { value: "16", label: "十度 · 16 半音" },
                  ]}
                  onChange={(span) => configure({ span: Number(span) })}
                />
                <label className="tempo-control">
                  速度 <span>{tempo} BPM</span>
                  <input
                    aria-label="速度 BPM"
                    type="range"
                    min="40"
                    max="140"
                    value={tempo}
                    onChange={(e) => {
                      stop();
                      setTempo(Number(e.target.value));
                    }}
                  />
                </label>
                <label className="loop-control">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                  循环播放
                </label>
                <div className="bar-actions">
                  <button
                    disabled={beats.length >= 128}
                    onClick={() => {
                      stop();
                      commitBeats([...beats, null, null, null, null]);

                      setCurrent(beats.length);
                    }}
                  >
                    <Plus size={16} /> 添加小节
                  </button>
                  <button
                    disabled={beats.length <= 4}
                    onClick={() => {
                      stop();
                      const start = Math.floor(current / 4) * 4;
                      if (
                        anchor &&
                        beats.slice(start, start + 4).some((c) => c?.id === anchor.chordId)
                      )
                        setAnchor(null);
                      const next = beats.filter((_, i) => i < start || i >= start + 4);
                      if (start === 0)
                        next[0] = {
                          ...(next[0] || events.chords[events.indices[4]]),
                          reference: referenceAt(events.chords, events.indices[start + 4] ?? 0),
                        };
                      commitBeats(next);
                      setCurrent(Math.min(start, next.length - 1));
                    }}
                  >
                    删除当前小节
                  </button>
                </div>
                <button
                  className="wide subtle"
                  onClick={() => {
                    stop();
                    setAnchor(null);
                    commitBeats(initial);
                    setCurrent(0);
                  }}
                >
                  重置示例
                </button>
              </>
            )}
          </div>
          <div className="drawer-bottom">
            <button onClick={() => setDrawer(null)}>完成编辑</button>
            <button className="play" disabled={!voice} onClick={start}>
              <Play size={16} /> 收起并播放
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
}
export default App;
