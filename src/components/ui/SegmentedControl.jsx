export function SegmentedControl({ disabled = false, label, onChange, options, value }) {
  return (
    <div className="ui-segmented-control" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            className="ui-segmented-control-item"
            type="button"
            key={option.value}
            aria-pressed={selected}
            data-state={selected ? "active" : "inactive"}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
