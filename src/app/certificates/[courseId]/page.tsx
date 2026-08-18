import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { CertificatePrintButton } from '@/components/certificate-print-button';
import { isCertificateEligibleCourse } from '@/lib/course-origin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type CertificateCourse = { id: string; title: string; topic: string; creation_origin: string | null };
type CertificateModule = { id: string };
type CertificateProgress = { module_id: string; status: 'not_started' | 'in_progress' | 'completed'; completed_at: string | null };

function completionDate(progress: CertificateProgress[]) {
  const latest = progress.reduce<string | null>((value, item) => {
    if (!item.completed_at) return value;
    return !value || item.completed_at > value ? item.completed_at : value;
  }, null);
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(latest ? new Date(latest) : new Date());
}

export default async function CertificatePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const supabase = createSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title, topic, creation_origin')
    .eq('id', courseId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (courseError || !course) notFound();

  const { count: sourceCount, error: sourceError } = await supabase
    .from('course_sources')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  if (sourceError || !isCertificateEligibleCourse(course.creation_origin, sourceCount ?? 0)) notFound();

  const { data: modules, error: moduleError } = await supabase
    .from('course_modules')
    .select('id')
    .eq('course_id', courseId);
  if (moduleError || !modules?.length) notFound();

  const { data: progress, error: progressError } = await supabase
    .from('module_progress')
    .select('module_id, status, completed_at')
    .eq('user_id', userId)
    .in('module_id', modules.map((module) => module.id));
  if (progressError) notFound();

  const moduleRows = modules as CertificateModule[];
  const progressRows = (progress ?? []) as CertificateProgress[];
  const completedIds = new Set(progressRows.filter((item) => item.status === 'completed').map((item) => item.module_id));
  if (completedIds.size !== moduleRows.length) notFound();

  const user = await currentUser();
  const learnerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Varen learner';
  const savedCourse = course as CertificateCourse;
  const certificateCode = `VRN-${savedCourse.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  return <main className="certificate-space">
    <header className="certificate-screen-header">
      <Link href={`/courses/${courseId}`}>← Back to completed course</Link>
      <div><Link href="/learning-path">Learning Path</Link><CertificatePrintButton /></div>
    </header>
    <section className="certificate-stage">
      <article className="certificate-paper" aria-label={`Certificate of completion for ${savedCourse.title}`}>
        <span className="certificate-corner certificate-corner-top" aria-hidden="true" />
        <span className="certificate-corner certificate-corner-bottom" aria-hidden="true" />
        <div className="certificate-inner-border">
          <p className="certificate-brand">Varen</p>
          <p className="certificate-kicker">LEARNING WORKSPACE · CERTIFICATE OF COMPLETION</p>
          <div className="certificate-medallion" aria-hidden="true"><span>V</span></div>
          <h1>Certificate of<br /><em>Completion</em></h1>
          <p className="certificate-intro">This certificate is proudly presented to</p>
          <strong className="certificate-learner">{learnerName}</strong>
          <p className="certificate-copy">for successfully completing the Varen AI-generated learning path</p>
          <h2>{savedCourse.title}</h2>
          <p className="certificate-topic">{savedCourse.topic}</p>
          <div className="certificate-details">
            <div><span>COMPLETED ON</span><strong>{completionDate(progressRows)}</strong></div>
            <div className="certificate-signature"><span>Varen Learning Workspace</span><strong>Learning Achievement</strong></div>
            <div><span>CERTIFICATE ID</span><strong>{certificateCode}</strong></div>
          </div>
          <p className="certificate-note">Issued for successful completion of an AI Course Generation path on Varen.</p>
        </div>
      </article>
    </section>
  </main>;
}
