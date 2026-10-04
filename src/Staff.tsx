import { spelling } from "./music";
import type { Voicing } from "./music";
import { noteOffsets, scoreSegments, timeline } from "./practice";
import type { Beat } from "./practice";
import { DragScroll } from "./DragScroll";

export function Staff({
  beats,
  voices,
  current,
  onSelect,
}: {
  beats: Beat[];
  voices: Voicing[];
  current: number;
  onSelect: (beat: number) => void;
}) {
  const { chords, indices } = timeline(beats),
    segments = scoreSegments(beats);
  const cell = 112,
    offset = 60,
    width = offset + segments.length * cell + 16;
  const active = segments.findLastIndex((s) => s.beat <= current);
  return (
    <DragScroll
      label="五线谱，左右拖动浏览"
      className="score-rail"
      followKey={Math.floor(current / 4)}
    >
      <svg
        className="score"
        role="img"
        aria-label="紧凑大谱表，橙色为左手，绿色为右手"
        viewBox={`0 0 ${width} 264`}
        style={{
          width: `calc(${width}px * var(--score-scale))`,
          height: "calc(264px * var(--score-scale))",
        }}
      >
        <text x="8" y="88" fontSize="48" fontFamily="serif">
          𝄞
        </text>
        <text x="10" y="189" fontSize="42" fontFamily="serif">
          𝄢
        </text>
        {[58, 158].map((top) => (
          <g key={top}>
            {[0, 1, 2, 3, 4].map((l) => (
              <line
                key={l}
                x1="5"
                x2={width - 16}
                y1={top + l * 10}
                y2={top + l * 10}
                stroke="#b9c1b1"
              />
            ))}
          </g>
        ))}
        {segments.map(({ beat, duration }, i) => {
          const x = offset + i * cell,
            chord = chords[indices[beat]],
            v = voices[indices[beat]];
          return (
            <g
              key={beat}
              data-follow={Math.floor(beat / 4)}
              data-score-beat={beat}
              className="score-beat"
              role="button"
              tabIndex={0}
              aria-label={`第${Math.floor(beat / 4) + 1}小节第${(beat % 4) + 1}拍音符`}
              onClick={() => onSelect(beat)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(beat);
                }
              }}
            >
              <rect
                x={x}
                y="12"
                width={cell}
                height="235"
                rx="4"
                fill={i === active ? "#e7efdf" : "transparent"}
                fillOpacity=".75"
              />
              {beat % 4 === 0 && <line x1={x} x2={x} y1="58" y2="198" stroke="#aab7a0" />}
              {v &&
                [
                  { notes: v.right, bass: false },
                  { notes: [v.bass], bass: true },
                ].map(({ notes, bass }) => {
                  const positions = notes.map((n) => spelling(n, chord, bass)),
                    shifts = noteOffsets(positions.map((p) => p.diatonic)),
                    bottom = bass ? 198 : 98,
                    anchor = bass ? 18 : 30;
                  const color = i === active ? (bass ? "#b8773f" : "#38684f") : "#707e66",
                    accidentalColumns: number[][] = [];
                  return (
                    <g key={String(bass)}>
                      {positions.map((s, j) => {
                        const y = bottom - (s.diatonic - anchor) * 5,
                          nx = x + 55 + shifts[j],
                          ledgers: number[] = [];
                        for (let ly = bottom + 10; ly <= y; ly += 10) ledgers.push(ly);
                        for (let ly = bottom - 50; ly >= y; ly -= 10) ledgers.push(ly);
                        let column = 0;
                        if (s.accidental) {
                          while (
                            accidentalColumns[column]?.some((p) => Math.abs(p - s.diatonic) < 4)
                          )
                            column++;
                          (accidentalColumns[column] ??= []).push(s.diatonic);
                        }
                        return (
                          <g key={j} fill={color}>
                            {ledgers.map((ly) => (
                              <line
                                key={ly}
                                x1={nx - 11}
                                x2={nx + 11}
                                y1={ly}
                                y2={ly}
                                stroke={color}
                              />
                            ))}
                            {s.accidental && (
                              <text
                                x={x + 40 - column * 17}
                                y={y + 5}
                                textAnchor="end"
                                fontSize="16"
                              >
                                {s.accidental.replaceAll("b", "♭").replaceAll("#", "♯")}
                              </text>
                            )}
                            <ellipse
                              data-note={s.name + s.octave}
                              data-position={s.diatonic}
                              data-offset={shifts[j]}
                              cx={nx}
                              cy={y}
                              rx="6.5"
                              ry="4"
                              fill={duration === 1 ? color : "#fffef9"}
                              stroke={color}
                              strokeWidth="1.7"
                              transform={`rotate(-18 ${nx} ${y})`}
                            />
                            {duration < 4 && (
                              <line
                                x1={nx + 6}
                                x2={nx + 6}
                                y1={y}
                                y2={bottom - (positions.at(-1)!.diatonic - anchor) * 5 - 26}
                                stroke={color}
                                strokeWidth="1.3"
                              />
                            )}
                            {duration === 3 && (
                              <circle
                                cx={nx + 13}
                                cy={y - (s.diatonic % 2 === 0 ? 3 : 0)}
                                r="1.8"
                              />
                            )}
                          </g>
                        );
                      })}
                      {beat % 4 === 0 && !beats[beat] && (
                        <path
                          d={`M ${x + 19} ${bottom + 26} Q ${x + 33} ${bottom + 33} ${x + 50} ${bottom + 26}`}
                          fill="none"
                          stroke={color}
                        />
                      )}
                    </g>
                  );
                })}
            </g>
          );
        })}
        <line x1={width - 16} x2={width - 16} y1="58" y2="198" stroke="#aab7a0" />
      </svg>
    </DragScroll>
  );
}
