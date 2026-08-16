import { CommunityDashboardShell } from '@/components/community-dashboard-shell';
import { SpaceAdmin } from '@/components/space-admin';

export default async function CommunityManagePage() {
  return <CommunityDashboardShell activeHref="/dashboard/community/manage"><SpaceAdmin /></CommunityDashboardShell>;
}
