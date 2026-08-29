import { useEffect, useState } from 'react';

const TAGLINES = [
  'Every rep counts. Keep pushing.',
  "You didn't come this far to only come this far.",
  'Discipline beats motivation on the hard days.',
  'Small wins today, big changes over time.',
  'Show up. That’s the whole secret.',
  'Your only competition is who you were yesterday.',
  'Strong body, stronger mind.',
  'Consistency is the real superpower.',
];

export default function MotivationalTagline() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TAGLINES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let fadeOutId: ReturnType<typeof setTimeout>;
    let swapId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      fadeOutId = setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        swapId = setTimeout(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % TAGLINES.length);
          setVisible(true);
          scheduleNext();
        }, 300);
      }, 7000);
    }
    scheduleNext();

    return () => {
      cancelled = true;
      clearTimeout(fadeOutId);
      clearTimeout(swapId);
    };
  }, []);

  return (
    <span className={`inline-block transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {TAGLINES[index]}
    </span>
  );
}
