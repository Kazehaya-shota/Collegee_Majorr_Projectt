import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getLearnerStats, type LearnerStats } from '@/lib/gamification';
import { ProductSwitcher } from '@/components/product-switcher';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type CourseRow = { id: string; title: string; topic: string; estimated_minutes: number; created_at: string };
type ModuleRow = { id: string; course_id: string; estimated_minutes: number; title: string };
type ProgressRow = { module_id: string; status: 'not_started' | 'in_progress' | 'completed'; completed_at: string | null; quiz_score: number | null; quiz_completed_at: string | null };
type ActivityRow = { id: string; activity_type: 'lesson' | 'quiz' | 'course' | 'interview'; xp_earned: number; activity_date: string; created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).slice(0, 1);
}

function activityLabel(activity: ActivityRow) {
  if (activity.activity_type === 'course') return 'Course completed';
  if (activity.activity_type === 'quiz') return 'Quiz passed';
  if (activity.activity_type === 'interview') return 'Interview mock completed';
  return 'Lesson completed';
}

export default async function LearningReportPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await currentUser();
  const firstName = user?.firstName || user?.username || 'there';
  let stats: LearnerStats = { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0 };
  let courses: CourseRow[] = [];
  let modules: ModuleRow[] = [];
  let progressRows: ProgressRow[] = [];
  let activities: ActivityRow[] = [];
  let loadError = false;

  try {
    const supabase = createSupabaseAdminClient();
    const { data: courseData, error: coursesError } = await supabase.from('courses').select('id, title, topic, estimated_minutes, created_at').eq('owner_id', userId).order('updated_at', { ascending: false });
    if (coursesError) throw coursesError;
    courses = (courseData ?? []) as CourseRow[];
    const courseIds = courses.map((course) => course.id);
    const { data: moduleData, error: modulesError } = courseIds.length ? await supabase.from('course_modules').select('id, course_id, estimated_minutes, title').in('course_id', courseIds) : { data: [], error: null };
    if (modulesError) throw modulesError;
    modules = (moduleData ?? []) as ModuleRow[];
    const moduleIds = modules.map((module) => module.id);
    const [{ data: progressData, error: progressError }, { data: activityData, error: activityError }] = await Promise.all([
      moduleIds.length ? supabase.from('module_progress').select('module_id, status, completed_at, quiz_score, quiz_completed_at').eq('user_id', userId).in('module_id', moduleIds) : Promise.resolve({ data: [], error: null }),
      supabase.from('learning_activity').select('id, activity_type, xp_earned, activity_date, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
    ]);
    if (progressError || activityError) throw progressError || activityError;
    progressRows = (progressData ?? []) as ProgressRow[];
    activities = (activityData ?? []) as ActivityRow[];
    stats = await getLearnerStats(supabase, userId);
  } catch (error) {
    console.error('Learning report loading failed', error);
    loadError = true;
  }

  const progressByModule = new Map(progressRows.map((progress) => [progress.module_id, progress]));
  const completedModules = modules.filter((module) => progressByModule.get(module.id)?.status === 'completed');
  const totalMinutes = modules.reduce((total, module) => total + module.estimated_minutes, 0);
  const completedMinutes = completedModules.reduce((total, module) => total + module.estimated_minutes, 0);
  const completionRate = modules.length ? Math.round((completedModules.length / modules.length) * 100) : 0;
  const quizScores = progressRows.map((progress) => progress.quiz_score).filter((score): score is number => typeof score === 'number');
  const averageQuizScore = quizScores.length ? Math.round(quizScores.reduce((total, score) => total + score, 0) / quizScores.length) : 0;
  const quizPassRate = quizScores.length ? Math.round((quizScores.filter((score) => score >= 67).length / quizScores.length) * 100) : 0;
  const completedCourses = courses.filter((course) => { const courseModules = modules.filter((module) => module.course_id === course.id); return courseModules.length > 0 && courseModules.every((module) => progressByModule.get(module.id)?.status === 'completed'); });
  const activeCourse = courses.find((course) => { const courseModules = modules.filter((module) => module.course_id === course.id); return courseModules.some((module) => progressByModule.get(module.id)?.status === 'completed') && !courseModules.every((module) => progressByModule.get(module.id)?.status === 'completed'); }) ?? courses[0];
  const now = new Date();
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(now.getTime() - (6 - index) * DAY_MS); const key = dateKey(date); const dayActivities = activities.filter((activity) => activity.activity_date === key); return { key, label: formatDay(date), xp: dayActivities.reduce((total, activity) => total + activity.xp_earned, 0), activities: dayActivities.length }; });
  const peakWeekXp = Math.max(10, ...week.map((day) => day.xp));
  const levelProgress = stats.totalXp % 300;

  return <main className="report-space"><header className="dashboard-header"><Link className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>course<span>master</span></span></Link><ProductSwitcher /><UserButton /></header><section className="report-hero"><Link href="/learning-path" className="back-to-dashboard">← Back to Learning Space</Link><p className="eyebrow dark"><span>LEARNING REPORT</span> YOUR PROGRESS, IN FOCUS</p><h1>{firstName}&apos;s <em>learning story.</em></h1><p>A live view of your progress across courses, quizzes, interview practice, XP, study momentum, and next best step.</p>{loadError && <p className="planner-error">Your report data could not load completely right now. Please refresh and try again.</p>}</section><section className="report-metric-grid" aria-label="Learning report metrics"><article className="report-xp-card"><span>⚡</span><div><small>TOTAL EXPERIENCE</small><strong>{stats.totalXp} XP</strong><p>Level {stats.level} · {300 - levelProgress || 300} XP to the next level</p></div><i><b style={{ width: `${(levelProgress / 300) * 100}%` }} /></i></article><article><span>◎</span><small>COURSE COMPLETION</small><strong>{completionRate}%</strong><p>{completedModules.length} of {modules.length} modules finished</p></article><article><span>🔥</span><small>LEARNING STREAK</small><strong>{stats.currentStreak} days</strong><p>Personal best: {stats.longestStreak} days</p></article><article><span>✓</span><small>QUIZ AVERAGE</small><strong>{quizScores.length ? `${averageQuizScore}%` : '—'}</strong><p>{quizScores.length ? `${quizPassRate}% pass rate across ${quizScores.length} ${quizScores.length === 1 ? 'quiz' : 'quizzes'}` : 'Complete a module quiz to see this'}</p></article></section><section className="report-main-grid"><div className="report-column"><section className="report-panel momentum-panel"><header><div><p className="eyebrow dark"><span>THIS WEEK</span> MOMENTUM</p><h2>Small actions add up.</h2></div><strong>{week.reduce((total, day) => total + day.xp, 0)} XP</strong></header><div className="week-chart">{week.map((day) => <div key={day.key}><span className="week-bar-wrap"><i style={{ height: `${day.xp ? Math.max(12, (day.xp / peakWeekXp) * 100) : 4}%` }} /><b>{day.xp ? `${day.xp} XP` : ''}</b></span><small>{day.label}</small><em>{day.activities ? `${day.activities} action${day.activities === 1 ? '' : 's'}` : 'Rest'}</em></div>)}</div></section><section className="report-panel course-report"><header><div><p className="eyebrow dark"><span>{String(courses.length).padStart(2, '0')}</span> COURSE LIBRARY</p><h2>Your paths, at a glance.</h2></div><Link href="/learning-path">Open library →</Link></header>{courses.length ? <div>{courses.map((course) => { const courseModules = modules.filter((module) => module.course_id === course.id); const complete = courseModules.filter((module) => progressByModule.get(module.id)?.status === 'completed').length; const percent = courseModules.length ? Math.round((complete / courseModules.length) * 100) : 0; return <article key={course.id}><div><span>{course.topic}</span><strong>{course.title}</strong><small>{complete}/{courseModules.length} modules · ~{course.estimated_minutes} min</small></div><b>{percent}%</b><i><em style={{ width: `${percent}%` }} /></i><Link href={`/courses/${course.id}`}>{percent ? 'Continue' : 'Open'} →</Link></article>; })}</div> : <div className="report-empty"><span>✦</span><strong>Your report will grow here.</strong><p>Create your first course to begin tracking progress, quizzes, and rewards.</p><Link href="/dashboard/course-generator">Create a course →</Link></div>}</section></div><aside className="report-column"><section className="report-panel next-step-panel"><p className="eyebrow"><span>NEXT BEST STEP</span> KEEP GOING</p>{activeCourse ? <><h2>{activeCourse.title}</h2><p>{completedMinutes ? `${completedMinutes} of ${totalMinutes} planned minutes completed across your paths.` : 'Start the first module to begin turning your plan into progress.'}</p><Link href={`/courses/${activeCourse.id}`}>Continue this path →</Link></> : <><h2>Your first win is waiting.</h2><p>Create a course from a goal, your notes, an article, a YouTube playlist, or a focused interview mock.</p><Link href="/dashboard">Open Dashboard →</Link></>}</section><section className="report-panel knowledge-panel"><p className="eyebrow dark"><span>KNOWLEDGE CHECKS</span> QUIZ INSIGHT</p><div><strong>{quizScores.length}</strong><span>quizzes taken</span></div><div><strong>{quizScores.length ? `${averageQuizScore}%` : '—'}</strong><span>average score</span></div><div><strong>{quizScores.length ? `${quizPassRate}%` : '—'}</strong><span>pass rate</span></div></section><section className="report-panel activity-panel"><header><p className="eyebrow dark"><span>RECENT ACTIVITY</span> MILESTONES</p></header>{activities.length ? <ol>{activities.slice(0, 6).map((activity) => <li key={activity.id}><span>{activity.activity_type === 'lesson' ? '✦' : activity.activity_type === 'quiz' ? '✓' : activity.activity_type === 'interview' ? '◌' : '◎'}</span><div><strong>{activityLabel(activity)}</strong><small>{activity.activity_date}</small></div><b>+{activity.xp_earned}</b></li>)}</ol> : <div className="activity-empty">Your completed lessons, quizzes, and interview mocks will appear here.</div>}</section></aside></section><section className="report-footer"><div><span>COURSEMASTER INSIGHT</span><h2>{completedCourses.length ? `You have completed ${completedCourses.length} learning path${completedCourses.length === 1 ? '' : 's'}.` : completedModules.length ? 'You are building real learning momentum.' : 'Every path starts with one module.'}</h2><p>{activities.length ? `You have earned ${stats.totalXp} XP through ${activities.length} recorded learning actions.` : 'Complete your first lesson or interview mock to start generating your personal learning record.'}</p></div><Link href="/learning-path">Back to Learning Space →</Link></section></main>;
}
