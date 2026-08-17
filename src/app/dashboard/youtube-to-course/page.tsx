import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ProductSwitcher } from '@/components/product-switcher';
import { YouTubeCourseWorkspace } from '@/components/youtube-course-workspace';

export default async function YouTubeToCoursePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <main className="tool-space"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link><ProductSwitcher /><UserButton /></header><section className="tool-hero"><Link href="/dashboard" className="back-to-dashboard">← Back to dashboard</Link><p className="eyebrow dark"><span>YOUTUBE TO COURSE</span> TURN WATCHING INTO LEARNING</p><h1>From play button<br />to <em>real progress.</em></h1><p>Use a public YouTube video or playlist as the starting point for a focused learning path you can save and study.</p></section><YouTubeCourseWorkspace /></main>;
}
