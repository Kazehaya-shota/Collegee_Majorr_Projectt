import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { InterviewPrepWorkspace } from '@/components/interview-prep-workspace';
import { ProductSwitcher } from '@/components/product-switcher';

export default async function InterviewPrepPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <main className="tool-space interview-page"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>course<span>master</span></span></Link><ProductSwitcher /><UserButton /></header><div className="interview-back-wrap"><Link href="/dashboard" className="back-to-dashboard">← Back to dashboard</Link></div><InterviewPrepWorkspace /></main>;
}
