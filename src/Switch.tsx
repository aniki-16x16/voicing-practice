import "./Switch.css";

export function Switch({
  label,
  checked,
  onChange,
  checkedText,
  uncheckedText,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  checkedText?: string;
  uncheckedText?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-text switch-text-on" aria-hidden="true">
        {checkedText}
      </span>
      <span className="switch-text switch-text-off" aria-hidden="true">
        {uncheckedText}
      </span>
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  );
}
