import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ProductSwitcher } from '@/components/product-switcher';
import { ProfileAvatarUpload } from '@/components/profile-avatar-upload';
import { ProfileNameEditor } from '@/components/profile-name-editor';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getLearnerStats, type LearnerStats } from '@/lib/gamification';

type Course = { id: string; title: string; topic: string; created_at: string };
type Module = { id: string; course_id: string };
type Progress = { module_id: string; status: 'not_started' | 'in_progress' | 'completed' };

const toolLinks = [{ icon: '✦', label: 'AI Course Generation', href: '/dashboard/course-generator' }, { icon: '↥', label: 'Content Ingestion', href: '/dashboard/content-ingestion' }, { icon: '▶', label: 'YouTube to Course', href: '/dashboard/youtube-to-course' }, { icon: '◌', label: 'Interview Prep', href: '/dashboard/interview-prep' }];

function firstLetter(value: string) { return value.trim().slice(0, 1).toUpperCase() || 'C'; }
function displayDate(value: Date | string | number | null | undefined) { return value ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(value)) : 'Recently'; }

export default async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const user = await currentUser();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Varen learner';
  const email = user?.primaryEmailAddress?.emailAddress || 'No email linked';
  let courses: Course[] = [];
  let modules: Module[] = [];
  let progress: Progress[] = [];
  let stats: LearnerStats = { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0 };
  let interviewCount = 0;

  try {
    const supabase = createSupabaseAdminClient();
    const { data: courseData, error: courseError } = await supabase.from('courses').select('id, title, topic, created_at').eq('owner_id', userId).order('updated_at', { ascending: false });
    if (courseError) throw courseError;
    courses = (courseData ?? []) as Course[];
    const courseIds = courses.map((course) => course.id);
    const { data: moduleData, error: moduleError } = courseIds.length ? await supabase.from('course_modules').select('id, course_id').in('course_id', courseIds) : { data: [], error: null };
    if (moduleError) throw moduleError;
    modules = (moduleData ?? []) as Module[];
    const moduleIds = modules.map((module) => module.id);
    const { data: progressData, error: progressError } = moduleIds.length ? await supabase.from('module_progress').select('module_id, status').eq('user_id', userId).in('module_id', moduleIds) : { data: [], error: null };
    if (progressError) throw progressError;
    progress = (progressData ?? []) as Progress[];
    stats = await getLearnerStats(supabase, userId);
    const { count, error: interviewError } = await supabase.from('interview_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (!interviewError) interviewCount = count ?? 0;
  } catch (error) { console.error('Profile data loading failed', error); }

  const completedModules = new Set(progress.filter((item) => item.status === 'completed').map((item) => item.module_id));
  const completedCourses = courses.filter((course) => { const items = modules.filter((module) => module.course_id === course.id); return items.length > 0 && items.every((module) => completedModules.has(module.id)); });
  const startedCourses = courses.filter((course) => modules.filter((module) => module.course_id === course.id).some((module) => completedModules.has(module.id)));
  const levelProgress = stats.totalXp % 300;

  return <main className="app-dashboard profile-dashboard"><aside className="app-dashboard-sidebar"><Link className="app-dashboard-brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>va<span>ren</span></span></Link><nav aria-label="Profile navigation"><Link href="/dashboard"><span>⌂</span>Dashboard</Link><Link className="app-sidebar-current" href="/dashboard/profile"><span>👤</span>Profile</Link><div className="app-sidebar-group"><p>LEARNING TOOLS</p>{toolLinks.map((link) => <Link key={link.label} href={link.href}><span>{link.icon}</span>{link.label}</Link>)}</div><div className="app-sidebar-group"><p>YOUR SPACE</p><Link href="/learning-path"><span>▤</span>Learning Path</Link><Link href="/learning-path/report"><span>◒</span>Full Report</Link></div></nav><div className="app-sidebar-footer"><span>⚡</span><p><strong>Level {stats.level}</strong><small>{stats.totalXp} XP collected</small></p><Link href="/learning-path/report">View progress →</Link></div></aside><section className="app-dashboard-main"><header className="app-dashboard-topbar"><div className="app-topbar-welcome"><span>YOUR ACCOUNT</span><strong>Profile &amp; learning record</strong></div><ProductSwitcher /><div className="app-topbar-actions"><UserButton /></div></header><div className="profile-content"><section className="profile-hero"><ProfileAvatarUpload fallback={firstLetter(name)} initialImageUrl={user?.imageUrl} /><div><p className="eyebrow dark"><span>VAREN PROFILE</span> LEARNER ACCOUNT</p><ProfileNameEditor initialName={name} /><p>{email}</p><small>Learning with Varen since {displayDate(user?.createdAt)}</small></div><Link href="/learning-path/report">Open full report <span>→</span></Link></section><section className="profile-metrics"><article><span>⚡</span><strong>{stats.totalXp}</strong><small>Total XP</small></article><article><span>◎</span><strong>{courses.length}</strong><small>Paths created</small></article><article><span>✓</span><strong>{completedCourses.length}</strong><small>Courses completed</small></article><article><span>🔥</span><strong>{stats.longestStreak}</strong><small>Best streak</small></article></section><section className="profile-main-grid"><div><article className="profile-card profile-journey"><header><div><p className="eyebrow dark"><span>LEARNING IDENTITY</span> YOUR MOMENTUM</p><h2>Level {stats.level}<em> learner.</em></h2></div><span>{300 - levelProgress || 300} XP to level {stats.level + 1}</span></header><i><b style={{ width: `${(levelProgress / 300) * 100}%` }} /></i><div><section><strong>{startedCourses.length}</strong><small>paths started</small></section><section><strong>{completedModules.size}</strong><small>modules completed</small></section><section><strong>{interviewCount}</strong><small>interview mocks</small></section></div></article><article className="profile-card profile-history"><header><div><p className="eyebrow dark"><span>RECENT LEARNING</span> YOUR PATHS</p><h2>What you&apos;re building.</h2></div><Link href="/learning-path">View all →</Link></header>{courses.length ? <ol>{courses.slice(0, 4).map((course) => { const items = modules.filter((module) => module.course_id === course.id); const complete = items.filter((module) => completedModules.has(module.id)).length; const percent = items.length ? Math.round((complete / items.length) * 100) : 0; return <li key={course.id}><span>{firstLetter(course.title)}</span><div><small>{course.topic}</small><strong>{course.title}</strong><p>{complete}/{items.length} modules · {percent}% complete</p></div><Link href={`/courses/${course.id}`}>→</Link></li>; })}</ol> : <div className="profile-empty"><span>✦</span><p>Your learning story will start here.</p><Link href="/dashboard/course-generator">Create a first path →</Link></div>}</article></div><aside><article className="profile-card profile-certificates"><span className="certificate-seal">✦</span><p>CERTIFICATES</p><h2>Your completion<br />archive.</h2><strong>{completedCourses.length} completed</strong><small>Completed paths are collected here. Downloadable certificates can be added next.</small><div>{completedCourses.length ? <Link href="/learning-path">View completed paths →</Link> : <Link href="/learning-path">Complete your first path →</Link>}</div></article><article className="profile-card profile-account"><header><p>ACCOUNT DETAILS</p><span>● Active</span></header><dl><div><dt>Display name</dt><dd>{name}</dd></div><div><dt>Email address</dt><dd>{email}</dd></div><div><dt>Member since</dt><dd>{displayDate(user?.createdAt)}</dd></div><div><dt>Last signed in</dt><dd>{displayDate(user?.lastSignInAt)}</dd></div></dl></article></aside></section></div></section></main>;
}
