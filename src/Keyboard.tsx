import { mod, noteName, spelling } from "./music";
import type { Chord, Voicing } from "./music";
function Keyboard({ voice, chord }: { voice?: Voicing; chord?: Chord }) {
  const notes = Array.from({ length: 49 }, (_, i) => i + 36),
    whites = notes.filter((n) => ![1, 3, 6, 8, 10].includes(mod(n)));
  const label = (n: number) => {
    if (chord) {
      const s = spelling(n, chord, n === voice?.bass);
      return s.name + s.octave;
    }
    return noteName(n);
  };
  return (
    <div className="keyboard-scroll">
      <div className="keyboard">
        {whites.map((n) => (
          <div
            key={n}
            className={`key white ${n === voice?.bass ? "left-on" : voice?.right.includes(n) ? "right-on" : ""}`}
          >
            <span>
              {n === voice?.bass || voice?.right.includes(n)
                ? label(n)
                : mod(n) === 0
                  ? noteName(n)
                  : ""}
            </span>
          </div>
        ))}
        {notes
          .filter((n) => !whites.includes(n))
          .map((n) => {
            const before = whites.filter((w) => w < n).length;
            return (
              <div
                key={n}
                style={{
                  left: `${((before - 0.32) / whites.length) * 100}%`,
                  width: `${(0.64 / whites.length) * 100}%`,
                }}
                className={`key black ${n === voice?.bass ? "left-on" : voice?.right.includes(n) ? "right-on" : ""}`}
              >
                <span>{n === voice?.bass || voice?.right.includes(n) ? label(n) : ""}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default Keyboard;
