// 音量与音色统一在这里调节。听感约三倍按 +15.85 dB 估算，振幅约为原来的 6.2 倍。
export const soundSettings = {
  level: 0.1 * 10 ** ((10 * Math.log2(3)) / 20),
  attack: 0.008,
  decay: 0.14,
  sustain: 0.84,
  release: 0.055,
};

type Note = {
  oscillator: OscillatorNode;
  gain: GainNode;
  start: number;
  peak: number;
  releaseAt?: number;
};

/** Keep playback notes held until the next chord; auditions have a finite duration. */
export class ChordAudio {
  readonly context: BaseAudioContext;
  private readonly output: DynamicsCompressorNode;
  private readonly wave: PeriodicWave;
  private readonly notes = new Set<Note>();
  private active: Note[] = [];

  constructor(context: BaseAudioContext) {
    this.context = context;
    // 温和的泛音让起音更圆润；保留清晰音高，不依赖网络音色资源。
    this.wave = context.createPeriodicWave(
      new Float32Array(6),
      new Float32Array([0, 1, 0.16, 0.055, 0.022, 0.009]),
    );
    this.output = context.createDynamicsCompressor();
    // 只控制和弦交叠时的高峰，正常延音不压缩。
    this.output.threshold.value = -3;
    this.output.knee.value = 3;
    this.output.ratio.value = 12;
    this.output.attack.value = 0.002;
    this.output.release.value = 0.06;
    this.output.connect(context.destination);
  }

  play(pitches: number[], duration?: number, time = this.context.currentTime) {
    this.release(time);
    const peak = soundSettings.level / pitches.length;
    this.active = pitches.map((pitch) => {
      const oscillator = this.context.createOscillator();
      oscillator.setPeriodicWave(this.wave);
      oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(peak, time + soundSettings.attack);
      // 起音后仅轻微回落，随后保持延音，不再按和弦时长衰减到静音。
      gain.gain.linearRampToValueAtTime(
        peak * soundSettings.sustain,
        time + soundSettings.attack + soundSettings.decay,
      );
      oscillator.connect(gain);
      gain.connect(this.output);
      const note: Note = { oscillator, gain, start: time, peak };
      this.notes.add(note);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.notes.delete(note);
        this.active = this.active.filter((active) => active !== note);
      };
      oscillator.start(time);
      if (duration !== undefined) this.releaseNote(note, time + duration);
      return note;
    });
  }

  private releaseNote(note: Note, time: number) {
    if (note.releaseAt !== undefined && note.releaseAt <= time) return;
    // 从切换瞬间的实际音量开始短尾音，避免硬截断或包络重置造成爆音。
    const elapsed = Math.max(0, time - note.start);
    const level =
      elapsed < soundSettings.attack
        ? note.peak * (elapsed / soundSettings.attack)
        : elapsed < soundSettings.attack + soundSettings.decay
          ? note.peak *
            (1 -
              ((1 - soundSettings.sustain) * (elapsed - soundSettings.attack)) /
                soundSettings.decay)
          : note.peak * soundSettings.sustain;
    note.gain.gain.cancelAndHoldAtTime(time);
    // 显式标出尾音起点，避免浏览器把新的衰减斜坡连接到上一个包络拐点。
    note.gain.gain.setValueAtTime(level, time);
    note.gain.gain.linearRampToValueAtTime(0, time + soundSettings.release);
    note.oscillator.stop(time + soundSettings.release);
    note.releaseAt = time;
  }

  release(time = this.context.currentTime) {
    this.active.forEach((note) => this.releaseNote(note, time));
    this.active = [];
  }

  dispose() {
    for (const note of this.notes) {
      note.oscillator.onended = null;
      note.oscillator.stop();
      note.oscillator.disconnect();
      note.gain.disconnect();
    }
    this.notes.clear();
    this.active = [];
    this.output.disconnect();
  }
}
