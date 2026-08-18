import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { LandingPlanner } from '@/components/landing-planner';
import { getLearnerStats, type LearnerStats } from '@/lib/gamification';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ProductSwitcher } from '@/components/product-switcher';

type SavedCourse = { id: string; title: string; summary: string; topic: string; estimated_minutes: number; status: string };
type ModuleRow = { id: string; course_id: string };
type ProgressRow = { module_id: string; status: 'not_started' | 'completed' };
type CourseWithProgress = SavedCourse & { moduleCount: number; completedCount: number };

export default async function LearningPathPage() {
  const [{ userId }, user] = await Promise.all([auth(), currentUser()]);
  if (!userId) redirect('/sign-in');
  const firstName = user?.firstName || user?.username || 'there';
  let courses: CourseWithProgress[] = [];
  let isDatabaseReady = true;
  let stats: LearnerStats = { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0 };

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data, error }, learnerStats] = await Promise.all([
      supabase.from('courses').select('id, title, summary, topic, estimated_minutes, status').eq('owner_id', userId).order('updated_at', { ascending: false }),
      getLearnerStats(supabase, userId),
    ]);
    if (error) throw error;
    stats = learnerStats;
    const savedCourses = (data ?? []) as SavedCourse[];
    const courseIds = savedCourses.map((course) => course.id);
    const { data: modules, error: modulesError } = courseIds.length ? await supabase.from('course_modules').select('id, course_id').in('course_id', courseIds) : { data: [], error: null };
    if (modulesError) throw modulesError;
    const moduleRows = (modules ?? []) as ModuleRow[];
    const moduleIds = moduleRows.map((module) => module.id);
    const { data: progress, error: progressError } = moduleIds.length ? await supabase.from('module_progress').select('module_id, status').eq('user_id', userId).in('module_id', moduleIds) : { data: [], error: null };
    if (progressError) throw progressError;
    const completedModules = new Set((progress as ProgressRow[] ?? []).filter((item) => item.status === 'completed').map((item) => item.module_id));
    courses = savedCourses.map((course) => { const courseModules = moduleRows.filter((module) => module.course_id === course.id); return { ...course, moduleCount: courseModules.length, completedCount: courseModules.filter((module) => completedModules.has(module.id)).length }; });
  } catch (error) {
    console.error('Learning path loading failed', error);
    isDatabaseReady = false;
  }

  const activeCourse = courses.find((course) => course.completedCount < course.moduleCount) ?? courses[0];
  const levelProgress = stats.totalXp % 300;

  return <main className="dashboard-shell dashboard-v2"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Varen</span></Link><ProductSwitcher /><UserButton /></header><section className="dashboard-hero"><div><p className="eyebrow dark"><span>YOUR LEARNING SPACE</span> LEARNING PATH</p><h1>Welcome back,<br /><em>{firstName}.</em></h1><p>{activeCourse ? 'One small lesson is enough to keep your momentum going.' : 'Turn any learning goal into a structured path you can actually finish.'}</p><div className="dashboard-hero-actions">{activeCourse ? <Link href={`/courses/${activeCourse.id}`} className="primary-button">Continue learning <span>→</span></Link> : isDatabaseReady ? <a href="#create-path" className="primary-button">Create my first path <span>→</span></a> : null}{isDatabaseReady && <a href="#create-path" className="secondary-dashboard-action">+ New learning path</a>}</div></div><aside className="next-lesson-card">{activeCourse ? <><p><span>UP NEXT</span> YOUR ACTIVE PATH</p><h2>{activeCourse.title}</h2><div className="next-path-progress"><div><span>{activeCourse.completedCount} of {activeCourse.moduleCount} modules</span><strong>{activeCourse.moduleCount ? Math.round((activeCourse.completedCount / activeCourse.moduleCount) * 100) : 0}%</strong></div><i><b style={{ width: `${activeCourse.moduleCount ? (activeCourse.completedCount / activeCourse.moduleCount) * 100 : 0}%` }} /></i></div><Link href={`/courses/${activeCourse.id}`}>Pick up where you left off <span>→</span></Link></> : <><p><span>START SMALL</span> YOUR NEXT WIN</p><h2>A learning path made around you.</h2><p className="next-path-copy">Choose a goal, set your pace, and let Varen build the first version.</p><a href="#create-path">Build a path <span>→</span></a></>}</aside></section>{isDatabaseReady && <><section className="dashboard-overview" id="progress" aria-label="Learning overview"><article className="xp-overview"><div><span>⚡</span><p><strong>{stats.totalXp} XP</strong><small>Level {stats.level} · {300 - levelProgress || 300} XP to level {stats.level + 1}</small></p></div><i><b style={{ width: `${(levelProgress / 300) * 100}%` }} /></i></article><article><span>🔥</span><p><strong>{stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}</strong><small>{stats.currentStreak ? 'Your learning streak is alive' : 'Complete a lesson to start a streak'}</small></p></article><div className="report-overview"><Link href="/learning-path/report">View my full report →</Link><article><span>◎</span><p><strong>{courses.length} path{courses.length === 1 ? '' : 's'}</strong><small>{courses.length ? 'Personal learning plans saved' : 'Your library is ready'}</small></p></article></div></section><section className="dashboard-paths" id="my-paths"><header><div><p className="eyebrow dark"><span>{String(courses.length).padStart(2, '0')}</span> MY LEARNING PATHS</p><h2>{courses.length ? 'Keep building your knowledge.' : 'Your path library is waiting.'}</h2></div><a href="#create-path">Create a path <span>→</span></a></header>{courses.length ? <div className="dashboard-course-grid">{courses.map((course) => { const progress = course.moduleCount ? Math.round((course.completedCount / course.moduleCount) * 100) : 0; return <article key={course.id}><div className="course-card-top"><span>{course.status}</span><small>{course.topic}</small></div><h3>{course.title}</h3><p>{course.summary}</p><div className="course-card-progress"><div><span>{course.completedCount}/{course.moduleCount || '–'} modules</span><strong>{progress}%</strong></div><i><b style={{ width: `${progress}%` }} /></i></div><Link href={`/courses/${course.id}`}>{progress ? 'Continue path' : 'Start path'} <span>→</span></Link></article>; })}</div> : <div className="dashboard-empty-state"><span>✦</span><h3>Start with something you care about.</h3><p>Build a focused path from a skill, course topic, or project you want to understand better.</p><a href="#create-path" className="primary-button">Create my first path <span>→</span></a></div>}</section><section className="dashboard-create" id="create-path"><div className="dashboard-create-intro"><p className="eyebrow dark"><span>NEW PATH</span> PLAN YOUR NEXT SKILL</p><h2>What do you want<br />to <em>learn next?</em></h2><p>Your goal, available time, and trusted sources are all you need to begin.</p></div><LandingPlanner compact /></section></>}</main>;
}
