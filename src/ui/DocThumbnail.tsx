import { THUMB_COLORS, type Thumb } from '@/doc/thumb';

/** A small SVG picture of a project's graph. */
export function DocThumbnail({ thumb, size = 96 }: { thumb: Thumb | null; size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {thumb?.e.map(([a, b], i) => {
        const [x1, y1] = thumb.n[a];
        const [x2, y2] = thumb.n[b];
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6abf4b" strokeWidth={1} opacity={0.8} />;
      })}
      {thumb?.n.map(([x, y, r, c], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.06)" stroke={THUMB_COLORS[c] ?? '#3d97ff'} strokeWidth={1} />
      ))}
    </svg>
  );
}
