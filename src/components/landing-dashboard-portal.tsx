'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LandingDashboardPortal({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [isEntering, setIsEntering] = useState(false);

  function enterDashboard() {
    if (isEntering) return;
    setIsEntering(true);
    window.setTimeout(() => router.push('/dashboard'), 520);
  }

  return <section className={`landing-dashboard-portal${compact ? ' is-compact' : ''}${isEntering ? ' is-entering' : ''}`} aria-label="Open your dashboard"><p>{compact ? 'YOUR DASHBOARD IS READY' : 'YOUR WORKSPACE IS READY'}</p><button type="button" onClick={enterDashboard} aria-label="Enter your dashboard"><span className="landing-portal-grid"><i /><i /><i /><i /></span><b>Dashboard</b></button><small>{isEntering ? 'Opening your dashboard…' : compact ? 'Continue where you left off' : 'Enter your learning workspace'}</small></section>;
}
