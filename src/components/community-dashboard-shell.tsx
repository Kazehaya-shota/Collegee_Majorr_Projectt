import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ProductSwitcher } from '@/components/product-switcher';
import { CommunityWorkspace } from '@/components/community-workspace';
import type { ReactNode } from 'react';

type CommunityTab = 'rooms' | 'challenges' | 'events';

const groups = [
  { label: 'LEARNING TOOLS', links: [{ icon: '✦', label: 'AI Course Generation', href: '/dashboard/course-generator' }, { icon: '↥', label: 'Content Ingestion', href: '/dashboard/content-ingestion' }, { icon: '▶', label: 'YouTube to Course', href: '/dashboard/youtube-to-course' }, { icon: '◌', label: 'Interview Prep', href: '/dashboard/interview-prep' }] },
  { label: 'COMMUNITY SPACE', links: [{ icon: '◌', label: 'Study Rooms', href: '/dashboard/community/study-rooms' }, { icon: '⚑', label: 'Quiz Challenges', href: '/dashboard/community/quiz-challenges' }, { icon: '◇', label: 'Events & Hackathons', href: '/dashboard/community/events-hackathons' }, { icon: 'resource-exchange', label: 'Resource Exchange', href: '/dashboard/resource-exchange' }] },
  { label: 'YOUR SPACE', links: [{ icon: '▤', label: 'Learning Path', href: '/learning-path' }, { icon: '◒', label: 'Full Report', href: '/learning-path/report' }] },
];

export async function CommunityDashboardShell({ activeHref, initialTab, standalone = false, children }: { activeHref?: string; initialTab?: CommunityTab; standalone?: boolean; children?: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return <main className="app-dashboard community-dashboard"><aside className="app-dashboard-sidebar"><Link className="app-dashboard-brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>course<span>master</span></span></Link><nav aria-label="Community navigation"><Link className={activeHref === '/dashboard' ? 'app-sidebar-current' : ''} href="/dashboard"><span>⌂</span>Dashboard</Link><Link className={activeHref === '/dashboard/profile' ? 'app-sidebar-current' : ''} href="/dashboard/profile"><span>👤</span>Profile</Link>{groups.map((group) => <div key={group.label} className="app-sidebar-group"><p>{group.label}</p>{group.links.map((link) => <Link key={link.label} className={link.href === activeHref ? 'app-sidebar-current' : ''} href={link.href}>{link.icon === 'resource-exchange' ? <span className="resource-exchange-nav-icon" aria-hidden="true"><i /><i /><i /></span> : <span>{link.icon}</span>}{link.label}</Link>)}</div>)}</nav></aside><section className="app-dashboard-main"><header className="app-dashboard-topbar"><div className="app-topbar-welcome"><span>COURSEMASTER COMMUNITY SPACE</span><strong>Learn together, on purpose</strong></div><ProductSwitcher /><div className="app-topbar-actions"><UserButton /></div></header>{children ?? <CommunityWorkspace initialTab={initialTab} standalone={standalone} />}</section></main>;
}
