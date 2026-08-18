import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProductSwitcher } from '@/components/product-switcher';
import { StudySprintGame } from '@/components/study-sprint-game';
import { GlobalLeaderboard } from '@/components/global-leaderboard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getLearnerStats, type LearnerStats } from '@/lib/gamification';

type CourseRow = { id: string; title: string; summary: string; topic: string; estimated_minutes: number; created_at: string };
type ModuleRow = { id: string; course_id: string };
type ProgressRow = { module_id: string; status: 'not_started' | 'in_progress' | 'completed' };

const sidebarGroups = [
  {
    label: 'LEARNING TOOLS',
    links: [
      { icon: '✦', label: 'AI Course Generation', href: '/dashboard/course-generator' },
      { icon: '↥', label: 'Content Ingestion', href: '/dashboard/content-ingestion' },
      { icon: '▶', label: 'YouTube to Course', href: '/dashboard/youtube-to-course' },
      { icon: '◌', label: 'Interview Prep', href: '/dashboard/interview-prep' },
    ],
  },
  {
    label: 'COMMUNITY SPACE',
    links: [
      { icon: '◌', label: 'Study Rooms', href: '/dashboard/community/study-rooms' },
      { icon: '⚑', label: 'Quiz Challenges', href: '/dashboard/community/quiz-challenges' },
      { icon: '◇', label: 'Events & Hackathons', href: '/dashboard/community/events-hackathons' },
      { icon: 'resource-exchange', label: 'Resource Exchange', href: '/dashboard/resource-exchange' },
      { icon: '⚙', label: 'Space Admin', href: '/dashboard/community/manage' },
    ],
  },
  {
    label: 'YOUR SPACE',
    links: [
      { icon: '▤', label: 'Learning Path', href: '/learning-path' },
      { icon: '◒', label: 'Full Report', href: '/learning-path/report' },
    ],
  },
];

function courseInitial(title: string) {
  return title.trim().slice(0, 1).toUpperCase() || '✦';
}

function LeaderboardFallback() {
  return <article className="app-leaderboard-card app-leaderboard-loading" aria-busy="true" aria-label="Loading global leaderboard">
    <header><div><p>GLOBAL LEADERBOARD</p><h2>Learning leaders.</h2></div><span>LOADING</span></header>
    <div className="leaderboard-loading-lines"><i /><i /><i /></div>
  </article>;
}

export default async function DashboardPage() {
  const [{ userId }, user] = await Promise.all([auth(), currentUser()]);
  if (!userId) redirect('/sign-in');

  const firstName = user?.firstName || user?.username || 'there';
  let courses: CourseRow[] = [];
  let modules: ModuleRow[] = [];
  let progress: ProgressRow[] = [];
  let stats: LearnerStats = { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0 };

  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: courseData, error: courseError }, learnerStats] = await Promise.all([
      supabase
        .from('courses')
        .select('id, title, summary, topic, estimated_minutes, created_at')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(6),
      getLearnerStats(supabase, userId),
    ]);
    if (courseError) throw courseError;
    courses = (courseData ?? []) as CourseRow[];
    stats = learnerStats;

    const courseIds = courses.map((course) => course.id);
    const { data: moduleData, error: moduleError } = courseIds.length
      ? await supabase.from('course_modules').select('id, course_id').in('course_id', courseIds)
      : { data: [], error: null };
    if (moduleError) throw moduleError;
    modules = (moduleData ?? []) as ModuleRow[];

    const moduleIds = modules.map((module) => module.id);
    const { data: progressData, error: progressError } = moduleIds.length
      ? await supabase.from('module_progress').select('module_id, status').eq('user_id', userId).in('module_id', moduleIds)
      : { data: [], error: null };
    if (progressError) throw progressError;
    progress = (progressData ?? []) as ProgressRow[];
  } catch (error) {
    console.error('Dashboard data loading failed', error);
  }

  const completedByModule = new Set(progress.filter((item) => item.status === 'completed').map((item) => item.module_id));
  const inProgressCourses = courses.filter((course) => {
    const items = modules.filter((module) => module.course_id === course.id);
    return items.some((module) => completedByModule.has(module.id)) && !items.every((module) => completedByModule.has(module.id));
  });
  const completedCourses = courses.filter((course) => {
    const items = modules.filter((module) => module.course_id === course.id);
    return items.length > 0 && items.every((module) => completedByModule.has(module.id));
  });
  const displayCourses = courses.slice(0, 3);

  return <main className="app-dashboard">
    <aside className="app-dashboard-sidebar">
      <Link className="app-dashboard-brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>Varen</span></Link>
      <nav aria-label="Dashboard navigation">
        <Link className="app-sidebar-current" href="/dashboard"><span>⌂</span>Dashboard</Link>
        <Link href="/dashboard/profile"><span>👤</span>Profile</Link>
        {sidebarGroups.map((group) => <div key={group.label} className="app-sidebar-group">
          <p>{group.label}</p>
          {group.links.map((link) => <Link key={link.label} href={link.href}>{link.icon === 'resource-exchange' ? <span className="resource-exchange-nav-icon" aria-hidden="true"><i /><i /><i /></span> : <span>{link.icon}</span>}{link.label}</Link>)}
        </div>)}
      </nav>
      <div className="app-sidebar-footer"><span>⚡</span><p><strong>Level {stats.level}</strong><small>{stats.totalXp} XP collected</small></p><Link href="/learning-path/report">View progress →</Link></div>
    </aside>
    <section className="app-dashboard-main">
      <header className="app-dashboard-topbar">
        <div className="app-topbar-welcome"><span>YOUR WORKSPACE</span><strong>Welcome, {firstName}</strong></div>
        <ProductSwitcher />
        <div className="app-topbar-actions"><UserButton /></div>
      </header>
      <div className="app-dashboard-content">
        <section className="app-dashboard-intro">
          <div><p className="eyebrow dark"><span>DASHBOARD</span> TODAY&apos;S LEARNING VIEW</p><h1>Welcome back,<br /><em>{firstName}.</em></h1><p>Pick up a path, create something new, or turn a spare moment into real progress.</p></div>
          <Link href="/dashboard/course-generator" className="app-create-button"><span>✦</span><div><strong>Create a new course</strong><small>Start with a goal, source, or idea</small></div><b>→</b></Link>
        </section>
        <section className="app-dashboard-stats" aria-label="Learning overview">
          <article><span className="stat-book">▤</span><div><strong>{courses.length}</strong><small>Total paths</small></div></article>
          <article><span className="stat-progress">↗</span><div><strong>{inProgressCourses.length}</strong><small>In progress</small></div></article>
          <article><span className="stat-complete">✓</span><div><strong>{completedCourses.length}</strong><small>Completed</small></div></article>
          <article><span className="stat-streak">🔥</span><div><strong>{stats.currentStreak}</strong><small>Day streak</small></div></article>
        </section>
        <section className="app-dashboard-workbench">
          <article className="app-start-card"><div className="app-card-icon">✦</div><div><p>YOUR NEXT MOVE</p><h2>Build a path that<br />fits your <em>life.</em></h2><span>Use AI to shape a course from a goal, your notes, a public page, or a YouTube video.</span><Link href="/dashboard/course-generator">Open AI Course Generation <b>→</b></Link></div></article>
          <Suspense fallback={<LeaderboardFallback />}><GlobalLeaderboard currentUserId={userId} /></Suspense>
        </section>
        <section className="app-recent-courses">
          <header><div><p className="eyebrow dark"><span>YOUR LIBRARY</span> RECENT PATHS</p><h2>Keep your momentum.</h2></div><Link href="/learning-path">Open Learning Path →</Link></header>
          {displayCourses.length ? <div>{displayCourses.map((course) => {
            const courseModules = modules.filter((module) => module.course_id === course.id);
            const finished = courseModules.filter((module) => completedByModule.has(module.id)).length;
            const percent = courseModules.length ? Math.round((finished / courseModules.length) * 100) : 0;
            return <article key={course.id}><span className="course-initial">{courseInitial(course.title)}</span><div><small>{course.topic}</small><h3>{course.title}</h3><p>{finished} of {courseModules.length} modules complete</p><i><b style={{ width: `${percent}%` }} /></i></div><Link href={`/courses/${course.id}`} aria-label={`Open ${course.title}`}>→</Link></article>;
          })}</div> : <div className="app-empty-library"><span>✦</span><div><strong>Your first path starts here.</strong><p>Choose a topic or bring in something you already want to understand.</p></div><Link href="/dashboard/course-generator">Create a course →</Link></div>}
        </section>
        <div className="app-study-sprint"><StudySprintGame /></div>
      </div>
    </section>
  </main>;
}
