import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ContentIngestionWorkspace } from '@/components/content-ingestion-workspace';
import { ProductSwitcher } from '@/components/product-switcher';

export default async function ContentIngestionPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <main className="tool-space"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link><ProductSwitcher /><UserButton /></header><section className="tool-hero"><Link href="/dashboard" className="back-to-dashboard">← Back to dashboard</Link><p className="eyebrow dark"><span>CONTENT INGESTION</span> PREPARE YOUR LEARNING MATERIAL</p><h1>Bring the material.<br /><em>Make it meaningful.</em></h1><p>Extract useful context from articles, notes, and large text documents before turning it into a course that follows your actual college material.</p></section><ContentIngestionWorkspace /></main>;
}
