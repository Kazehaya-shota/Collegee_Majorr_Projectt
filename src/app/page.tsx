import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { LandingPlanner } from '@/components/landing-planner';
import { LandingDashboardPortal } from '@/components/landing-dashboard-portal';
import { ThemeToggle } from '@/components/theme-toggle';

const workflows = [
  { icon: '✦', kicker: 'AI course generation', title: 'Begin with a goal', text: 'Tell Zentrix what you want to understand. It maps the skill into a course that has a real finish line.', className: 'goal' },
  { icon: '⌁', kicker: 'Content ingestion', title: 'Bring your own material', text: 'Turn notes, chapter text, documents, and public web pages into the learning path they were meant to be.', className: 'ingest' },
  { icon: '▶', kicker: 'YouTube to Course', title: 'Make watching intentional', text: 'Use a public video or playlist as the starting point, then learn through structured modules and checks.', className: 'video' },
  { icon: '◌', kicker: 'Interview prep', title: 'Practice before it matters', text: 'Take a role-aware AI mock, get a practical scorecard, and continue with targeted career resources.', className: 'interview' },
  { icon: '↗', kicker: 'Learning rewards', title: 'See progress compound', text: 'Earn XP, build your streak, and use your learning report to keep a clear sense of momentum.', className: 'rewards' },
];

const benefits = [
  ['01', 'A course, not a content dump', 'Every path has a sequence, detailed reading space, completion moments, adaptive quizzes, and a clear next move.'],
  ['02', 'One place for every source', 'Start from a goal, your own material, a public web page, or YouTube — without losing the original context.'],
  ['03', 'Motivation you can feel', 'XP, streaks, checkpoints, and a detailed report make consistent learning visible instead of abstract.'],
  ['04', 'Ready for the next room', 'Use role-aware interview mocks, constructive feedback, and career resources to turn learning into confidence.'],
];

const faqs = [
  ['How does Zentrix create a course?', 'Start with a learning goal, a web page, notes, a text document, or a public YouTube video or playlist. Zentrix uses that context to design a structured learning path.'],
  ['Can I use college notes or chapter material?', 'Yes. Content Ingestion lets you paste chapter text, upload supported text documents, or bring in readable public pages. That material becomes the primary context for the course.'],
  ['What happens after a course is generated?', 'Save it to Your Learning Path. Each module opens in its own focused reader with detailed content, related visuals, recommended resources, a completion step, and a quiz.'],
  ['How do XP and streaks work?', 'You earn XP for completing lessons, passing quizzes, and finishing a full course. Returning to learn on consecutive days builds your streak.'],
  ['Does YouTube to Course use a video transcript?', 'It uses public YouTube titles, descriptions, creator information, and playlist order to build a course. Videos with detailed descriptions provide the strongest context.'],
  ['What is Interview Prep?', 'Interview Prep gives you a role-aware AI mock interview, a detailed scorecard, and curated next resources. It is practice support, not a source of official past questions or hiring decisions.'],
];

export default async function HomePage() {
  const { userId } = await auth();
  const primaryHref = userId ? '/dashboard' : '#planner';
  const primaryLabel = userId ? 'Open my workspace' : 'Create my first course';

  return (
    <main className="landing-v3" id="top">
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="#top" aria-label="Zentrix home">
          <span className="landing-brand-mark"><i /><i /><i /></span>
          <span>zen<span>trix</span></span>
        </Link>
        <div className="landing-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#why">Why Zentrix</a>
          <a href="#faqs">FAQs</a>
        </div>
        <div className="landing-auth">
          <ThemeToggle />
          {userId ? <UserButton /> : <><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Join free <span>→</span></Link></>}
        </div>
      </nav>

      {userId && <div className="landing-dashboard-shortcut"><LandingDashboardPortal compact /></div>}

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><i /> AI learning workspace</p>
          <h1 id="landing-title">Learn from anything.<br /><em>Make it yours.</em></h1>
          <p className="landing-lede">Zentrix turns a goal, a chapter, a web page, or a YouTube video into a course you can actually finish.</p>
          <div className="landing-hero-actions">
            <Link className="landing-primary" href={primaryHref}>{primaryLabel} <span>→</span></Link>
            <a className="landing-secondary" href="#how-it-works"><span className="landing-play">▶</span> See how it works</a>
          </div>
          <div className="landing-proof"><span className="landing-proof-pips"><i /><i /><i /></span><span>Built for curious learners with real goals.</span></div>
        </div>

        <div className="landing-hero-visual" aria-label="Zentrix learning workspace preview">
          <div className="landing-orb orb-one" /><div className="landing-orb orb-two" />
          <div className="landing-source-card source-card-note"><span>⌁</span><b>Chapter notes</b><small>Connected</small></div>
          <div className="landing-source-card source-card-video"><span>▶</span><b>Video source</b><small>Ready to learn</small></div>
          <div className="landing-device">
            <div className="landing-device-top"><span className="device-dot" /><p>YOUR LEARNING PATH</p><i>•••</i></div>
            <div className="landing-device-body">
              <div className="device-course-label"><span>PERSONAL PATH</span><b>DAY 03 / 12</b></div>
              <h2>Foundations of<br />machine learning</h2>
              <div className="device-progress"><div><span>Course progress</span><b>36%</b></div><i><em /></i></div>
              <article className="device-active-module"><span>03</span><div><small>NOW LEARNING</small><strong>How models find patterns</strong><p>12 min · Reading + quiz</p></div><b>→</b></article>
              <div className="device-stats"><span><b>✦ 320</b> XP earned</span><span><b>🔥 4</b> day streak</span></div>
            </div>
          </div>
          <div className="landing-complete-card"><span>✓</span><div><small>MODULE COMPLETE</small><b>Nice work. +40 XP</b></div></div>
        </div>
      </section>

      <section className="landing-signal" aria-label="Zentrix capabilities"><span>Built around</span><p>your goal <i>·</i> your material <i>·</i> your momentum <i>·</i> your next opportunity</p><b>Scroll to explore <em>↓</em></b></section>

      <section className="landing-workflows" aria-labelledby="workflow-title">
        <header><p className="landing-kicker"><i /> Five ways to begin</p><h2 id="workflow-title">The right start is<br /><em>the one you already have.</em></h2><p>Zentrix meets you at the idea, the resource, the video, or the opportunity ahead — then turns it into real progress.</p></header>
        <div className="landing-workflow-grid">
          {workflows.map((workflow) => { const href = workflow.className === 'interview' ? (userId ? '/dashboard/interview-prep' : '/sign-up') : userId ? '/dashboard' : '#planner'; return <article key={workflow.kicker} className={`workflow-card ${workflow.className}`}><span className="workflow-icon">{workflow.icon}</span><p>{workflow.kicker}</p><h3>{workflow.title}</h3><div className="workflow-visual" aria-hidden="true"><i /><i /><i /></div><span className="workflow-copy">{workflow.text}</span><Link href={href}>{workflow.className === 'interview' ? 'Try a mock' : 'Explore'} <b>→</b></Link></article>; })}
        </div>
      </section>

      <section className="landing-planner-wrap" id="planner">
        <div className="landing-section-intro"><p className="landing-kicker"><i /> Build a path in minutes</p><h2>Put your next<br />learning win <em>in motion.</em></h2><p>Give us a destination and we’ll shape the first version of your course around it.</p></div>
        <LandingPlanner />
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="steps-title">
        <header><p className="landing-kicker"><i /> How it works</p><h2 id="steps-title">Less hunting.<br /><em>More becoming.</em></h2></header>
        <ol>
          <li><span>01</span><div><small>CHOOSE A START</small><h3>Bring a goal or a source.</h3><p>Write what you want to learn, drop in a resource, or convert a YouTube video into a course.</p></div><i>↘</i></li>
          <li><span>02</span><div><small>MAKE IT PERSONAL</small><h3>Get a path with shape.</h3><p>Zentrix creates modules, focused lessons, recommended resources, and knowledge checks.</p></div><i>↘</i></li>
          <li><span>03</span><div><small>KEEP THE MOMENTUM</small><h3>Learn, finish, level up.</h3><p>Complete modules, unlock quizzes, collect XP, protect your streak, and see your progress grow.</p></div><i>↘</i></li>
        </ol>
      </section>

      <section className="landing-why" id="why" aria-labelledby="why-title">
        <div className="landing-why-copy"><p className="landing-kicker"><i /> Why Zentrix</p><h2 id="why-title">A learning system<br />that feels <em>alive.</em></h2><p>There is no shortage of content. Zentrix gives your learning the structure, feedback, and little moments of momentum that make it stick.</p><Link href={userId ? '/learning-path' : '#planner'}>See your learning path <span>→</span></Link></div>
        <div className="landing-benefit-list">{benefits.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><i>↗</i></article>)}</div>
      </section>

      <section className="landing-ideas" aria-labelledby="ideas-title"><div><p className="landing-kicker"><i /> Make it real</p><h2 id="ideas-title">One quiet hour can<br />change what you know.</h2></div><div className="landing-idea-pills"><a href="#planner">Understand machine learning</a><a href="#planner">Turn my notes into a course</a><a href="#planner">Learn a YouTube playlist</a><a href="#planner">Prepare for an exam</a><a href="#planner">Build a stronger portfolio</a><Link className="interview-idea-link" href={userId ? '/dashboard/interview-prep' : '/sign-up'}>Practice an interview mock ↗</Link></div></section>

      <section className="landing-faq" id="faqs" aria-labelledby="faq-title"><header><p className="landing-kicker"><i /> FAQs</p><h2 id="faq-title">A few things you<br /><em>might be wondering.</em></h2><p>Everything you need to know before you start your next path.</p></header><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>

      <footer className="landing-footer"><Link className="landing-brand" href="#top"><span className="landing-brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link><p>Learning paths for the work and life ahead.</p><span>© 2026 Zentrix</span></footer>
    </main>
  );
}
