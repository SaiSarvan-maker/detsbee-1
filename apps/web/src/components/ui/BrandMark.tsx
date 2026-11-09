export function BrandMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 font-bold tracking-tight"
      style={{ fontSize: size * 0.42 }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="honeyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F0C453" />
            <stop offset="100%" stopColor="#D9A21A" />
          </linearGradient>
        </defs>
        <path
          d="M32 4l22 12.5v25L32 54 10 41.5v-25L32 4z"
          fill="url(#honeyGrad)"
          opacity="0.95"
        />
        <path
          d="M32 14l12 7v14l-12 7-12-7V21l12-7z"
          fill={light ? '#F7F1E6' : '#14120F'}
          opacity="0.9"
        />
        <circle cx="32" cy="28" r="3.2" fill="url(#honeyGrad)" />
      </svg>
      <span className={light ? 'text-cream' : 'text-ink-900'}>
        Dets<span className="text-honey-600">bee</span>
      </span>
    </span>
  );
}
