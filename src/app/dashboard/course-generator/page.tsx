import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { LandingPlanner } from '@/components/landing-planner';
import { ProductSwitcher } from '@/components/product-switcher';

export default async function CourseGeneratorPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <main className="tool-space"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Varen</span></Link><ProductSwitcher /><UserButton /></header><section className="tool-hero"><Link href="/dashboard" className="back-to-dashboard">← Back to dashboard</Link><p className="eyebrow dark"><span>AI COURSE GENERATION</span> YOUR PERSONAL LEARNING DESIGNER</p><h1>Turn a goal into<br />a <em>real learning path.</em></h1><p>Set your level and pace, then generate a structured course you can save, study, quiz yourself on, and complete.</p></section><section className="tool-planner"><LandingPlanner restoreIngestedSources /></section></main>;
}
