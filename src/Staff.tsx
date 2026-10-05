import type { Voicing } from "./music";
import { noteOffsets } from "./practice";
import { scoreNotation } from "./notation";
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
  const segments = scoreNotation(beats, voices);
  const cell = 112,
    offset = 50;
  const signatureWidths = segments.map((segment) =>
    segment.signature.length ? segment.signature.length * 12 + 16 : 0,
  );
  const layout = segments.map((segment, index) => {
    const signatureWidth = signatureWidths[index];
    const x =
      offset +
      index * cell +
      signatureWidths.slice(0, index).reduce((sum, width) => sum + width, 0);
    return { ...segment, x, signatureWidth };
  });
  const width =
    offset + segments.length * cell + signatureWidths.reduce((sum, width) => sum + width, 0) + 16;
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
        {layout.map(
          (
            { beat, duration, x, signatureWidth, signature, staves, voice: v, reference, changed },
            i,
          ) => {
            const noteX = x + signatureWidth;
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
                  // Enter 选择谱面位置；空格交给全局播放快捷键处理。
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSelect(beat);
                  }
                }}
              >
                <rect
                  x={x}
                  y="12"
                  width={cell + signatureWidth}
                  height="235"
                  rx="4"
                  fill={i === active ? "#e7efdf" : "transparent"}
                  fillOpacity=".75"
                />
                {beat % 4 === 0 && <line x1={x} x2={x} y1="58" y2="198" stroke="#aab7a0" />}
                {changed && (
                  <g data-key-signature={reference} aria-label={`${reference} 大调调号`}>
                    <text x={x + 8} y="32" fontSize="11" fill="#707e66">
                      {reference} 大调
                    </text>
                    {signature.map((sign, column) => (
                      <g key={column} data-key-accidental={sign.accidental}>
                        {[
                          { bottom: 98, anchor: 30, position: sign.treble },
                          { bottom: 198, anchor: 18, position: sign.bass },
                        ].map(({ bottom, anchor, position }) => (
                          <text
                            key={bottom}
                            x={x + 8 + column * 12}
                            y={bottom - (position - anchor) * 5 + 5}
                            fontSize="19"
                            fill="#707e66"
                          >
                            {sign.accidental.replaceAll("b", "♭").replaceAll("#", "♯")}
                          </text>
                        ))}
                      </g>
                    ))}
                  </g>
                )}
                {!v &&
                  [85, 185].map((y) => (
                    <text
                      key={y}
                      x={noteX + 55}
                      y={y}
                      textAnchor="middle"
                      fontFamily="serif"
                      fontSize="28"
                      fill="#8b9780"
                    >
                      {duration === 4 ? "𝄻" : duration >= 2 ? "𝄼" : "𝄽"}
                      {duration === 3 ? "·" : ""}
                    </text>
                  ))}
                {v &&
                  [
                    { positions: staves[0], bass: false },
                    { positions: staves[1], bass: true },
                  ].map(({ positions, bass }) => {
                    const shifts = noteOffsets(positions.map((p) => p.diatonic)),
                      bottom = bass ? 198 : 98,
                      anchor = bass ? 18 : 30;
                    const color = i === active ? (bass ? "#b8773f" : "#38684f") : "#707e66",
                      accidentalColumns: number[][] = [];
                    return (
                      <g key={String(bass)} data-hand={bass ? "left" : "right"}>
                        {positions.map((s, j) => {
                          const y = bottom - (s.diatonic - anchor) * 5,
                            nx = noteX + 55 + shifts[j],
                            ledgers: number[] = [];
                          for (let ly = bottom + 10; ly <= y; ly += 10) ledgers.push(ly);
                          for (let ly = bottom - 50; ly >= y; ly -= 10) ledgers.push(ly);
                          let column = 0;
                          if (s.displayAccidental) {
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
                              {s.displayAccidental && (
                                <text
                                  data-note-accidental={s.displayAccidental}
                                  x={noteX + 40 - column * 17}
                                  y={y + 5}
                                  textAnchor="end"
                                  fontSize="16"
                                >
                                  {s.displayAccidental.replaceAll("b", "♭").replaceAll("#", "♯")}
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
                            d={`M ${noteX + 19} ${bottom + 26} Q ${noteX + 33} ${bottom + 33} ${noteX + 50} ${bottom + 26}`}
                            fill="none"
                            stroke={color}
                          />
                        )}
                      </g>
                    );
                  })}
              </g>
            );
          },
        )}
        <line x1={width - 16} x2={width - 16} y1="58" y2="198" stroke="#aab7a0" />
      </svg>
    </DragScroll>
  );
}
