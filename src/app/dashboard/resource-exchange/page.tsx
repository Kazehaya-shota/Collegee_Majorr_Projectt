import { CommunityDashboardShell } from '@/components/community-dashboard-shell';
import { ResourceExchange } from '@/components/resource-exchange';

export default async function ResourceExchangePage() {
  return <CommunityDashboardShell activeHref="/dashboard/resource-exchange"><ResourceExchange /></CommunityDashboardShell>;
}
