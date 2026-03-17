type RaceCarProps = {
  color: string;
  accentColor: string;
  label?: string;
};

export function RaceCar({ color, accentColor, label }: RaceCarProps) {
  return (
    <svg viewBox="0 0 220 96" role="img" aria-label="Race car" className="race-car-svg">
      <rect x="10" y="58" width="200" height="16" rx="8" fill={color} />
      <rect x="62" y="38" width="96" height="24" rx="10" fill={color} />
      <rect x="90" y="26" width="40" height="16" rx="8" fill={accentColor} />
      <rect x="38" y="46" width="30" height="10" rx="5" fill={accentColor} />
      <rect x="152" y="46" width="30" height="10" rx="5" fill={accentColor} />

      <circle cx="48" cy="78" r="14" fill="#111" />
      <circle cx="48" cy="78" r="6" fill="#555" />
      <circle cx="172" cy="78" r="14" fill="#111" />
      <circle cx="172" cy="78" r="6" fill="#555" />

      {label ? (
        <text x="110" y="55" textAnchor="middle" fill="#f7f7f7" fontSize="18" fontWeight="700">
          {label}
        </text>
      ) : null}
    </svg>
  );
}
