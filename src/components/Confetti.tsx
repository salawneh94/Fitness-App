const COLORS = ['#22d3ee', '#fbbf24', '#3987e5', '#1baf7a', '#eb6834'];

interface Piece {
  left: number;
  color: string;
  delay: number;
  duration: number;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.3,
    duration: 1.6 + Math.random() * 0.8,
  }));
}

/** A brief confetti burst for celebratory moments — mount it, let it play once, unmount it. */
export default function Confetti({ count = 36 }: { count?: number }) {
  const pieces = makePieces(count);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 w-2 h-3 rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-10px',
            background: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
