import { redirect } from 'next/navigation';
import { CommunityDashboardShell } from '@/components/community-dashboard-shell';

const sections = {
  'study-rooms': { tab: 'rooms' as const, href: '/dashboard/community/study-rooms' },
  'quiz-challenges': { tab: 'challenges' as const, href: '/dashboard/community/quiz-challenges' },
  'events-hackathons': { tab: 'events' as const, href: '/dashboard/community/events-hackathons' },
};

export default async function CommunitySectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const current = sections[section as keyof typeof sections];
  if (!current) redirect('/dashboard/community/study-rooms');
  return <CommunityDashboardShell activeHref={current.href} initialTab={current.tab} standalone />;
}
