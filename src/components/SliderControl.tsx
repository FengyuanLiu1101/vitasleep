interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  displayValue?: string
  axisLeft?: string
  axisRight?: string
  onChange: (v: number) => void
}

export default function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  axisLeft,
  axisRight,
  onChange,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-1">{label}</span>
        <span className="text-[14px] font-semibold text-cyan-1">
          {displayValue ?? value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          className="vita-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--color-cyan-1) 0%, var(--color-cyan-1) ${pct}%, var(--color-bg-2) ${pct}%, var(--color-bg-2) 100%)`,
          }}
        />
      </div>
      {(axisLeft || axisRight) && (
        <div className="flex justify-between text-[11px] text-text-3">
          <span>{axisLeft}</span>
          <span>{axisRight}</span>
        </div>
      )}
    </div>
  )
}
