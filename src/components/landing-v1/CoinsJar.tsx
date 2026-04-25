export function CoinsJar() {
  return (
    <div className="relative mx-auto w-40 h-48 sm:w-[200px] sm:h-[240px]">
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
      <svg viewBox="0 0 200 240" className="relative w-full h-full" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--primary) / 0.5))' }}>
        {/* Lid */}
        <rect x="40" y="20" width="120" height="18" rx="6" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth="2" />
        {/* Jar body */}
        <path
          d="M 50 38 L 50 50 Q 30 60 30 90 L 30 210 Q 30 225 45 225 L 155 225 Q 170 225 170 210 L 170 90 Q 170 60 150 50 L 150 38 Z"
          fill="hsl(var(--primary) / 0.08)"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
        />
        {/* Highlight */}
        <path d="M 45 90 Q 42 130 50 200" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Text */}
        <text x="100" y="115" textAnchor="middle" fill="hsl(var(--primary))" fontSize="13" fontWeight="600">בנק דקות</text>
        <text x="100" y="170" textAnchor="middle" fill="hsl(var(--primary))" fontSize="48" fontWeight="800">120</text>
        <text x="100" y="195" textAnchor="middle" fill="hsl(var(--primary))" fontSize="13" fontWeight="600">דקות</text>
      </svg>
    </div>
  );
}
