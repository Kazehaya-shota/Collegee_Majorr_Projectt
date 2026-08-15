'use client';

import { useMemo, useState } from 'react';
import { companies, focuses, resourceShelf, roles, type InterviewFeedback, type InterviewPlan, type InterviewSetup } from '@/lib/interview-prep';
import { ProgressLoader } from '@/components/progress-loader';

type Stage = 'setup' | 'mock' | 'review';

const experienceLevels = ['Student / fresher', '0–2 years experience', '3–5 years experience', 'Career switcher'];

function Icon({ children }: { children: string }) { return <span className="interview-icon" aria-hidden="true">{children}</span>; }

export function InterviewPrepWorkspace() {
  const [stage, setStage] = useState<Stage>('setup');
  const [setup, setSetup] = useState<InterviewSetup>({ company: 'Amazon', role: 'Software Engineer', experience: 'Student / fresher', focus: 'Full interview loop', jobDescription: '' });
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState<'plan' | 'feedback' | null>(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'unsaved'>('idle');

  const currentQuestion = plan?.questions[questionIndex];
  const completion = plan ? Math.round(((questionIndex + 1) / plan.questions.length) * 100) : 0;
  const resources = useMemo(() => resourceShelf(setup), [setup]);

  function updateSetup(key: keyof InterviewSetup, value: string) { setSetup((current) => ({ ...current, [key]: value })); }

  async function beginMock() {
    setLoading('plan'); setError('');
    try {
      const response = await fetch('/api/interview/mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setup) });
      const payload = await response.json() as { plan?: InterviewPlan; error?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error || 'We could not prepare this mock interview.');
      setPlan(payload.plan); setAnswers(Array(payload.plan.questions.length).fill('')); setQuestionIndex(0); setFeedback(null); setSaveState('idle'); setStage('mock');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'We could not prepare this mock interview.'); }
    finally { setLoading(null); }
  }

  function updateAnswer(value: string) { setAnswers((current) => current.map((answer, index) => index === questionIndex ? value : answer)); }
  function previousQuestion() { setQuestionIndex((current) => Math.max(0, current - 1)); }

  async function finishMock() {
    if (!plan) return;
    setLoading('feedback'); setError('');
    try {
      const response = await fetch('/api/interview/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setup, plan, answers }) });
      const payload = await response.json() as { feedback?: InterviewFeedback; error?: string };
      if (!response.ok || !payload.feedback) throw new Error(payload.error || 'We could not review this mock interview.');
      setFeedback(payload.feedback); setStage('review');
      try {
        const saveResponse = await fetch('/api/interview/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setup, plan, answers, feedback: payload.feedback }) });
        setSaveState(saveResponse.ok ? 'saved' : 'unsaved');
      } catch { setSaveState('unsaved'); }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'We could not review this mock interview.'); }
    finally { setLoading(null); }
  }

  function nextQuestion() {
    if (!plan || !answers[questionIndex]?.trim()) { setError('Give this question an answer before continuing.'); return; }
    setError('');
    if (questionIndex === plan.questions.length - 1) { void finishMock(); return; }
    setQuestionIndex((current) => current + 1);
  }

  function restart() { setStage('setup'); setPlan(null); setFeedback(null); setAnswers([]); setQuestionIndex(0); setError(''); setSaveState('idle'); }

  return <section className="interview-workspace">
    <div className="interview-aurora interview-aurora-a" /><div className="interview-aurora interview-aurora-b" />
    <header className="interview-workspace-header"><div><p className="eyebrow dark"><span>CAREER LAUNCHPAD</span> INTERVIEW PREP</p><h1>Practice the moment<br />before it <em>matters.</em></h1><p>Build role-aware confidence with an adaptive mock, useful feedback, and the best next resources—inside your learning space.</p></div><aside className="interview-promise"><span>✦</span><strong>Thoughtful, not generic.</strong><p>Questions adapt to your target role, focus, and optional job description.</p><small>Practice questions — not official past papers.</small></aside></header>
    {loading && <ProgressLoader title={loading === 'plan' ? 'Preparing your interview room' : 'Reviewing your interview responses'} detail={loading === 'plan' ? 'Shaping a realistic question flow around your target.' : 'Finding the strongest patterns and clearest next steps.'} />}

    {stage === 'setup' && <div className="interview-setup-grid">
      <section className="interview-setup-card"><div className="interview-step"><span>01</span><p>SET YOUR TARGET</p></div><h2>Make this mock feel<br />like <em>your opportunity.</em></h2><p className="interview-copy">Choose a direction. You can paste a job description to make the conversation more relevant, but it is never required.</p>
        <div className="interview-field-grid"><label className="interview-company-field">Target company<span className="company-search-wrap">⌕<input type="search" list="coursemaster-company-list" value={setup.company} onChange={(event) => updateSetup('company', event.target.value)} placeholder="Search a company" autoComplete="off" /></span><small>Search 50+ leading global and Indian companies.</small><datalist id="coursemaster-company-list">{companies.map((company) => <option key={company} value={company} />)}</datalist></label><label>Target role<select value={setup.role} onChange={(event) => updateSetup('role', event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label><label>Where you are<select value={setup.experience} onChange={(event) => updateSetup('experience', event.target.value)}>{experienceLevels.map((level) => <option key={level}>{level}</option>)}</select></label><label>Mock focus<select value={setup.focus} onChange={(event) => updateSetup('focus', event.target.value)}>{focuses.map((focus) => <option key={focus}>{focus}</option>)}</select></label></div>
        <label className="interview-notes">Optional job description / notes<textarea value={setup.jobDescription} onChange={(event) => updateSetup('jobDescription', event.target.value)} placeholder="Paste key responsibilities, skills, or your own notes…" maxLength={4000} /><small>CourseMaster uses this only to shape your practice questions.</small></label>
        <div className="interview-loop-summary"><span><b>12</b> interviewer questions</span><span><b>35 min</b> realistic interview loop</span><span><b>1 report</b> feedback + resources</span></div>{error && <p className="interview-error" role="alert">{error}</p>}<button className="interview-primary" type="button" onClick={() => void beginMock()} disabled={loading === 'plan'}>{loading === 'plan' ? 'Preparing your interview…' : 'Start my practice interview'} <span>→</span></button>
      </section>
      <aside className="interview-side-stack"><article className="interview-scenario-card"><div><Icon>◌</Icon><span>YOUR PRACTICE ROOM</span></div><h3>{setup.company || 'Your target'}<br /><em>{setup.role}</em></h3><p>{setup.focus} · {setup.experience}</p><i><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /><b /></i><small>12 questions · 30–40 min · feedback at the end</small></article><article className="interview-method-card"><span>THE INTERVIEW LOOP</span><ol><li><b>01</b><div><strong>Open naturally</strong><p>Begin with your background, motivation, and strongest project story.</p></div></li><li><b>02</b><div><strong>Go deeper</strong><p>Work through role knowledge, decisions, trade-offs, and behavioural evidence.</p></div></li><li><b>03</b><div><strong>Close with clarity</strong><p>Finish with fit, thoughtful questions, and an actionable scorecard.</p></div></li></ol></article></aside>
    </div>}

    {stage === 'mock' && plan && currentQuestion && <section className="mock-room"><aside className="mock-sidebar"><div className="mock-brand"><Icon>✦</Icon><div><span>INTERVIEW IN PROGRESS</span><strong>{setup.company} · {setup.role}</strong></div></div><div className="mock-progress"><div><span>QUESTION {String(questionIndex + 1).padStart(2, '0')} OF {String(plan.questions.length).padStart(2, '0')}</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i></div><ol>{plan.questions.map((question, index) => <li key={question.id} className={index === questionIndex ? 'is-active' : index < questionIndex ? 'is-done' : ''}><button type="button" onClick={() => setQuestionIndex(index)}><b>{index < questionIndex ? '✓' : String(index + 1).padStart(2, '0')}</b><span>{question.category}</span></button></li>)}</ol><p><strong>Interview note</strong>There is no timer. Take a breath, answer naturally, and give specific examples where they help.</p></aside>
      <div className="mock-main"><header><div><p>{plan.title}</p><h2>{currentQuestion.category}<span> / {String(questionIndex + 1).padStart(2, '0')}</span></h2></div><small>~{plan.estimatedMinutes} min session</small></header><article className="mock-question-card"><span>INTERVIEWER ASKS</span><h3>{currentQuestion.prompt}</h3><div><Icon>↗</Icon><p><strong>Helpful cue</strong>{currentQuestion.cue}</p></div></article><label className="mock-answer"><span>YOUR ANSWER</span><textarea value={answers[questionIndex] || ''} onChange={(event) => updateAnswer(event.target.value)} placeholder="Start answering in your own words…" autoFocus /><small>{(answers[questionIndex] || '').trim().split(/\s+/).filter(Boolean).length} words · Aim for a clear example, action, and outcome.</small></label>{error && <p className="interview-error" role="alert">{error}</p>}<footer><button className="interview-back" type="button" onClick={previousQuestion} disabled={questionIndex === 0 || loading !== null}>← Previous</button><button className="interview-primary" type="button" onClick={nextQuestion} disabled={loading !== null}>{loading === 'feedback' ? 'Your coach is reviewing…' : questionIndex === plan.questions.length - 1 ? 'Finish & get my report' : 'Continue'} <span>→</span></button></footer></div>
    </section>}

    {stage === 'review' && feedback && <section className="interview-review"><header className="review-hero"><div><p className="eyebrow dark"><span>MOCK COMPLETE</span> YOUR INTERVIEW SIGNAL</p><h2>You showed up.<br />Now <em>make it sharper.</em></h2><p>{feedback.summary}</p><div className="review-actions"><button type="button" className="interview-primary" onClick={restart}>Practice again <span>→</span></button><span>{saveState === 'saved' ? '✓ Saved to your progress · +45 XP' : saveState === 'unsaved' ? 'Report ready · saving needs one quick setup' : 'Preparing your saved report…'}</span></div></div><article className="readiness-orbit"><div><span>READINESS</span><strong>{feedback.score}</strong><small>/ 100</small></div><p>{feedback.readiness}</p></article></header>
      <div className="review-score-grid"><article className="review-score-card"><span>YOUR SIGNAL</span><h3>{feedback.readiness}</h3><p>{feedback.strengths[0]}</p><i><b style={{ width: `${feedback.score}%` }} /></i><small>{feedback.score}/100 overall practice score</small></article><article className="review-radar-card"><span>SKILL SNAPSHOT</span><div>{feedback.categoryScores.map((item) => <p key={item.label}><b>{item.label}</b><i><em style={{ width: `${item.score}%` }} /></i><strong>{item.score}</strong></p>)}</div></article></div>
      <div className="review-detail-grid"><article className="review-panel"><header><span>✦</span><div><p>WHAT LANDED</p><h3>Keep these strengths.</h3></div></header><ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></article><article className="review-panel review-growth"><header><span>↗</span><div><p>WHERE TO SHARPEN</p><h3>One good next rep at a time.</h3></div></header><div>{feedback.growthAreas.map((area) => <section key={area.title}><strong>{area.title}</strong><p>{area.note}</p></section>)}</div></article></div>
      <section className="resource-shelf"><header><div><p className="eyebrow dark"><span>YOUR NEXT RESOURCES</span> KEEP THE MOMENTUM</p><h2>Turn feedback into<br /><em>real confidence.</em></h2></div><p>Chosen around your target role, interview focus, and growth areas. External resources open in a new tab.</p></header><div>{resources.map((resource, index) => <a key={resource.title} href={resource.url} target="_blank" rel="noreferrer"><span>{String(index + 1).padStart(2, '0')}</span><small>{resource.type} · {resource.source}</small><h3>{resource.title}</h3><p>{resource.description}</p><b>Open resource <i>↗</i></b></a>)}</div></section>
      <section className="review-next"><div><span>YOUR 3-STEP RESET</span><h2>Before the next interview.</h2></div><ol>{feedback.nextSteps.map((step, index) => <li key={step}><b>0{index + 1}</b><p>{step}</p></li>)}</ol></section>
    </section>}
  </section>;
}
