'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

function DashboardIcon() {
  return <span className="workspace-icon workspace-icon-dashboard" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function LearningPathIcon() {
  return <span className="workspace-icon workspace-icon-path" aria-hidden="true"><i /><i /><i /></span>;
}

export function ProductSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isLearningPath = pathname.startsWith('/learning-path') || pathname.startsWith('/courses/');

  return <><div className={`workspace-switcher ${open ? 'is-open' : ''}`}><div className="workspace-side workspace-side-dashboard"><Link href="/dashboard" role="menuitem" className={!isLearningPath ? 'is-current' : ''} onClick={() => setOpen(false)}><DashboardIcon /><span><strong>Dashboard</strong><small>AI learning tools</small></span></Link></div><button type="button" className={`workspace-orb ${isLearningPath ? 'is-path' : 'is-dashboard'}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Choose workspace">{isLearningPath ? <LearningPathIcon /> : <DashboardIcon />}</button><div className="workspace-side workspace-side-path"><Link href="/learning-path" role="menuitem" className={isLearningPath ? 'is-current' : ''} onClick={() => setOpen(false)}><span><strong>Your Learning Path</strong><small>Courses &amp; progress</small></span><LearningPathIcon /></Link></div></div><ThemeToggle /></>;
}
