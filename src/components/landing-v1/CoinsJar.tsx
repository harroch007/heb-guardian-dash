export function CoinsJar() {
  return (
    <div className="relative mx-auto w-44 h-52 sm:w-[220px] sm:h-[260px]">
      {/* Glow halo */}
      <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full" />
      <svg
        viewBox="0 0 220 260"
        className="relative w-full h-full"
        style={{ filter: 'drop-shadow(0 0 24px hsl(var(--primary) / 0.55))' }}
      >
        <defs>
          <linearGradient id="jarGlass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          </linearGradient>
          <linearGradient id="lidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Lid */}
        <rect
          x="46"
          y="18"
          width="128"
          height="22"
          rx="8"
          fill="url(#lidGrad)"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
        />
        {/* Neck */}
        <rect
          x="58"
          y="40"
          width="104"
          height="14"
          fill="hsl(var(--primary) / 0.15)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />
        {/* Jar body */}
        <path
          d="M 54 54 Q 26 70 26 110 L 26 226 Q 26 244 46 244 L 174 244 Q 194 244 194 226 L 194 110 Q 194 70 166 54 Z"
          fill="url(#jarGlass)"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
        />
        {/* Inner shine */}
        <path
          d="M 44 100 Q 38 160 50 220"
          stroke="hsl(var(--primary) / 0.7)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 56 90 Q 52 140 58 200"
          stroke="hsl(var(--primary) / 0.35)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Text */}
        <text
          x="110"
          y="120"
          textAnchor="middle"
          fill="hsl(var(--primary))"
          fontSize="15"
          fontWeight="700"
        >
          בנק דקות
        </text>
        <text
          x="110"
          y="180"
          textAnchor="middle"
          fill="hsl(var(--primary))"
          fontSize="56"
          fontWeight="900"
          style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.8))' }}
        >
          120
        </text>
        <text
          x="110"
          y="208"
          textAnchor="middle"
          fill="hsl(var(--primary))"
          fontSize="15"
          fontWeight="700"
        >
          דקות
        </text>
      </svg>
    </div>
  );
}
