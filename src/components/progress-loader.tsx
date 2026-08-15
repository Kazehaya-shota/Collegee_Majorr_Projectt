'use client';

import { useEffect, useState } from 'react';

type ProgressLoaderProps = {
  title: string;
  detail: string;
  compact?: boolean;
};

export function ProgressLoader({ title, detail, compact = false }: ProgressLoaderProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current < 38) return Math.min(38, current + 6);
        if (current < 68) return Math.min(68, current + 4);
        if (current < 86) return Math.min(86, current + 2);
        return Math.min(94, current + 1);
      });
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  const phase = progress < 38 ? 'PREPARING' : progress < 68 ? 'SHAPING' : progress < 86 ? 'REFINING' : 'ALMOST READY';

  return <section className={`cm-progress-loader${compact ? ' is-compact' : ''}`} role="status" aria-live="polite">
    <div className="cm-loader-orbit" aria-hidden="true"><i /><i /><i /><span>✦</span></div>
    <div className="cm-loader-copy"><span>{phase}</span><strong>{title}</strong><p>{detail}</p><div className="cm-loader-track"><i style={{ width: `${progress}%` }} /></div></div>
    <b className="cm-loader-percent">{progress}%</b>
  </section>;
}
