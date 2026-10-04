import { degree, rootAtDegree } from "./music";
import { Select } from "./Select";

const options = Array.from({ length: 7 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

export function DegreeSelect({
  label,
  note,
  reference,
  onChange,
}: {
  label: string;
  note: string;
  reference: string;
  onChange: (note: string) => void;
}) {
  const value = degree(note, reference);
  const number = Number(value.at(-1));
  const alteration = value.startsWith("#") ? 1 : value.startsWith("b") ? -1 : 0;
  return (
    <div className="degree-row">
      <Select
        label={label}
        value={String(number)}
        options={options}
        showAll
        onChange={(next) => onChange(rootAtDegree(Number(next), reference, alteration))}
      />
      <div className="accidental-field">
        <span>升降</span>
        <div className="accidental-buttons" role="group" aria-label={`${label}升降号`}>
          {([-1, 1] as const).map((sign) => (
            <button
              key={sign}
              type="button"
              aria-label={`${label}${sign === -1 ? "降低" : "升高"}半音`}
              aria-pressed={alteration === sign}
              title={`${sign === -1 ? "降低" : "升高"}半音，再次点击还原`}
              onClick={() =>
                onChange(rootAtDegree(number, reference, alteration === sign ? 0 : sign))
              }
            >
              {sign === -1 ? "♭" : "♯"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
