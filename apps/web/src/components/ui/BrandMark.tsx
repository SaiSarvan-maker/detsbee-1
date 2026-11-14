export function BrandMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 font-bold tracking-tight"
      style={{ fontSize: size * 0.42 }}
    >
      <img
        src="/detsbee-icon.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="shrink-0 rounded-xl object-cover"
        draggable={false}
      />
      <span className={light ? 'text-cream' : 'text-ink-900'}>
        Dets<span className="text-honey-600">bee</span>
      </span>
    </span>
  );
}
