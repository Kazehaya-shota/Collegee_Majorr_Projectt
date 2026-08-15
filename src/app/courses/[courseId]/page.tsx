import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { CoursePlayer, type PlayerModule } from '@/components/course-player';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getLearnerStats } from '@/lib/gamification';
import { ProductSwitcher } from '@/components/product-switcher';

type Course = { id: string; title: string; summary: string; topic: string; estimated_minutes: number };
type Module = { id: string; position: number; title: string; description: string; estimated_minutes: number };
type Progress = { module_id: string; status: 'not_started' | 'completed' };
type Source = { id: string; source_type: 'link' | 'note'; label: string; url: string | null; source_text: string | null };

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { userId } = await auth();
  if (!userId) notFound();
  const supabase = createSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase.from('courses').select('id, title, summary, topic, estimated_minutes').eq('id', courseId).eq('owner_id', userId).maybeSingle();
  if (courseError) throw new Error('Could not load this course.');
  if (!course) notFound();

  const { data: modules, error: modulesError } = await supabase.from('course_modules').select('id, position, title, description, estimated_minutes').eq('course_id', courseId).order('position');
  if (modulesError) throw new Error('Could not load the course modules.');
  const { data: progress, error: progressError } = await supabase.from('module_progress').select('module_id, status').eq('user_id', userId).in('module_id', (modules ?? []).map((module) => module.id));
  if (progressError) throw new Error('Could not load your progress.');
  const { data: sources, error: sourcesError } = await supabase.from('course_sources').select('id, source_type, label, url, source_text').eq('course_id', courseId).order('created_at');
  if (sourcesError) throw new Error('Could not load this course’s sources.');

  const progressByModule = new Map((progress as Progress[] ?? []).map((item) => [item.module_id, item.status]));
  const playerModules: PlayerModule[] = (modules as Module[] ?? []).map((module) => ({ id: module.id, position: module.position, title: module.title, description: module.description, estimatedMinutes: module.estimated_minutes, status: progressByModule.get(module.id) ?? 'not_started' }));
  const savedCourse = course as Course;
  const courseSources = sources as Source[] ?? [];
  const learnerStats = await getLearnerStats(supabase, userId);

  return <main className="course-shell"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>course<span>master</span></span></Link><ProductSwitcher /><UserButton /></header><section className="course-hero"><Link href="/learning-path" className="back-to-dashboard">← All learning paths</Link><p className="eyebrow dark"><span>YOUR PATH</span> {savedCourse.topic}</p><h1>{savedCourse.title}</h1><p>{savedCourse.summary}</p><div><span>~{savedCourse.estimated_minutes} minutes</span><span>{playerModules.length} modules</span></div></section><CoursePlayer courseId={courseId} modules={playerModules} initialStats={learnerStats} />{courseSources.length > 0 && <section className="course-sources"><p className="eyebrow dark"><span>{String(courseSources.length).padStart(2, '0')}</span> COURSE SOURCES</p><div>{courseSources.map((source) => <article key={source.id}><span>{source.source_type === 'link' ? '↗' : '✎'}</span><div><strong>{source.label}</strong><small>{source.source_type === 'link' ? source.url : source.source_text}</small></div>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Open ↗</a>}</article>)}</div></section>}</main>;
}
