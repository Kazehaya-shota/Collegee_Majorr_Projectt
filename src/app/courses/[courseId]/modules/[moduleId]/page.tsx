import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import { ModuleLessonPlayer } from '@/components/module-lesson-player';
import { ProductSwitcher } from '@/components/product-switcher';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type Module = { id: string; course_id: string; position: number; title: string; description: string; estimated_minutes: number };

export default async function ModuleLessonPage({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params;
  const { userId } = await auth();
  if (!userId) notFound();
  const supabase = createSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase.from('courses').select('id, title, topic').eq('id', courseId).eq('owner_id', userId).maybeSingle();
  if (courseError) throw new Error('Could not load this learning path.');
  if (!course) notFound();
  const { data: module, error: moduleError } = await supabase.from('course_modules').select('id, course_id, position, title, description, estimated_minutes').eq('id', moduleId).eq('course_id', courseId).maybeSingle();
  if (moduleError) throw new Error('Could not load this module.');
  if (!module) notFound();
  const { data: progress } = await supabase.from('module_progress').select('status').eq('user_id', userId).eq('module_id', moduleId).maybeSingle();
  const lessonModule = module as Module;

  return <main className="lesson-space"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Varen</span></Link><ProductSwitcher /><UserButton /></header><section className="lesson-space-header"><Link href={`/courses/${courseId}`} className="back-to-dashboard">← Back to learning path</Link><p className="eyebrow dark"><span>MODULE {String(lessonModule.position).padStart(2, '0')}</span> {course.topic}</p><h1>{lessonModule.title}</h1><p>{lessonModule.description}</p><small>~{lessonModule.estimated_minutes} minutes · read, practise, then take the quiz</small></section><ModuleLessonPlayer courseId={courseId} moduleId={moduleId} initialCompleted={progress?.status === 'completed'} /></main>;
}
