'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CourseDraft } from '@/lib/course-draft';
import type { CourseSource } from '@/lib/course-sources';
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_MB, readDocument } from '@/lib/document-ingestion';
import { ProgressLoader } from '@/components/progress-loader';

const suggestions = ['AI product management', 'Data storytelling', 'Negotiation skills'];
const placeholderModules = [
  ['01', 'Set the foundations', 'Why it matters, principles, and a shared vocabulary'],
  ['02', 'Build a shared language', 'Naming, patterns, and lightweight documentation'],
  ['03', 'Create components that scale', 'Anatomy, variants, and meaningful constraints'],
  ['04', 'Work with design tokens', 'Turn visual decisions into reusable rules'],
  ['05', 'Put governance into practice', 'Review rituals, ownership, and adoption'],
  ['06', 'Apply it to a real project', 'A focused final challenge and reflection'],
];

export function LandingPlanner({ compact = false, restoreIngestedSources = false }: { compact?: boolean; restoreIngestedSources?: boolean }) {
  const router = useRouter();
  const [topic, setTopic] = useState('Design systems for product teams');
  const [level, setLevel] = useState('Some experience');
  const [timePerDay, setTimePerDay] = useState('20 minutes a day');
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [sources, setSources] = useState<CourseSource[]>([]);
  const [sourceInputOpen, setSourceInputOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'link' | 'note' | 'file'>('link');
  const [sourceValue, setSourceValue] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coachRequest, setCoachRequest] = useState('');
  const [coachFeedback, setCoachFeedback] = useState('This is a draft, so you remain in control. Tell me what would make the path work better for you.');
  const [isCoaching, setIsCoaching] = useState(false);
  const [error, setError] = useState('');
  const [isSourceDriven, setIsSourceDriven] = useState(false);
  const hasRestoredIngestedSources = useRef(false);
  const modules = draft?.modules ?? placeholderModules.map(([number, title, description]) => ({ number, title, description, estimatedMinutes: 25 }));

  async function addSource() {
    const value = sourceValue.trim();
    if (!value) return;
    if (sources.length >= 5) { setError('You can add up to five sources to one learning path.'); return; }
    if (sourceType === 'link') {
      try {
        const url = new URL(value);
        setIsIngesting(true);
        const response = await fetch('/api/ingest/web', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.toString() }) });
        const result = await response.json() as { label?: string; url?: string; sourceText?: string; error?: string };
        if (!response.ok || !result.label || !result.url || !result.sourceText) throw new Error(result.error || 'This web page could not be read.');
        setSources((current) => [...current, { sourceType: 'link', label: result.label!, url: result.url!, sourceText: result.sourceText! }]);
        setError('');
      } catch (sourceError) {
        setError(sourceError instanceof Error ? sourceError.message : 'We could not ingest that link.');
        return;
      } finally { setIsIngesting(false); }
    } else {
      setSources((current) => [...current, { sourceType: 'note', label: `Your note ${current.length + 1}`, sourceText: value }]);
      setError('');
    }
    setSourceValue('');
  }

  async function addDocument(file: File | undefined) {
    if (!file) return;
    if (sources.length >= 5) { setError('You can add up to five sources to one learning path.'); return; }
    try {
      setIsIngesting(true);
      const sourceText = await readDocument(file);
      if (sourceText.length < 40) throw new Error('That document does not contain enough readable text.');
      setSources((current) => [...current, { sourceType: 'note', label: file.name, sourceText }]);
      setError('');
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'We could not read that document.');
    } finally { setIsIngesting(false); }
  }

  const generatePath = useCallback(async (nextTopic = topic, nextSources = sources) => {
    setError('');
    setIsGenerating(true);
    try {
      const response = await fetch('/api/courses/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: nextTopic, level, timePerDay, sources: nextSources }) });
      const result = await response.json() as { draft?: CourseDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error || 'Course generation failed.');
      setDraft(result.draft);
      setTimeout(() => document.querySelector('#preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Course generation failed.');
    } finally { setIsGenerating(false); }
  }, [level, sources, timePerDay, topic]);

  useEffect(() => {
    if (!restoreIngestedSources || hasRestoredIngestedSources.current) return;
    hasRestoredIngestedSources.current = true;
    try {
      const stored = window.sessionStorage.getItem('varen-ingestion-sources');
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;
      const restored = parsed.filter((source): source is CourseSource => Boolean(source) && typeof source === 'object' && Boolean((source as CourseSource).label) && Boolean((source as CourseSource).sourceText)).slice(0, 5);
      if (!restored.length) return;
      const inferredTopic = restored[0].label;
      const restoreTimer = window.setTimeout(() => {
        setSources(restored);
        setTopic(inferredTopic);
        setIsSourceDriven(true);
        setCoachFeedback('Creating a course directly from your prepared material. You can adjust it once the first draft is ready.');
        window.sessionStorage.removeItem('varen-ingestion-sources');
        void generatePath(inferredTopic, restored);
      }, 0);
      return () => window.clearTimeout(restoreTimer);
    } catch {
      // The generator still works normally if a prior browser session cannot be restored.
    }
  }, [generatePath, restoreIngestedSources]);

  async function buildPath(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await generatePath(); }

  async function savePath() {
    if (!draft) return;
    setError('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, topic, level, timePerDay, sources }) });
      const result = await response.json() as { courseId?: string; error?: string };
      if (!response.ok || !result.courseId) throw new Error(result.error || 'Course saving failed.');
      router.push('/learning-path');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Course saving failed.');
    } finally { setIsSaving(false); }
  }

  async function refinePath(instruction: string) {
    if (!draft || !instruction.trim()) return;
    setError('');
    setIsCoaching(true);
    setCoachFeedback('Thinking through the best adjustment for your path…');
    try {
      const response = await fetch('/api/courses/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft, instruction }) });
      const result = await response.json() as { draft?: CourseDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error || 'Course refinement failed.');
      setDraft(result.draft);
      setCoachRequest('');
      setCoachFeedback('Done — I updated the path. Review the modules, then save it when it feels right.');
    } catch (coachError) {
      setCoachFeedback('I could not update the path just now. Please try again.');
      setError(coachError instanceof Error ? coachError.message : 'Course refinement failed.');
    } finally { setIsCoaching(false); }
  }

  function addSourceFromCoach() {
    setSourceInputOpen(true);
    setCoachFeedback('The source input is open above. Add a page, note, or document, then create the path again so it can use that context.');
    setTimeout(() => document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  return <>
    {(isGenerating || isIngesting || isSaving || isCoaching) && <ProgressLoader title={isGenerating ? 'Designing your learning path' : isIngesting ? 'Reading your source material' : isSaving ? 'Saving your learning path' : 'Updating your course plan'} detail={isGenerating ? 'Sequencing the right concepts, practice, and pace for you.' : isIngesting ? 'Finding the key ideas Varen should learn from.' : isSaving ? 'Adding your new path to your learning space.' : 'Applying your coach’s feedback to the course structure.'} />}
    <section className={`planner-section${compact ? ' planner-compact' : ''}`} id="planner">
      {!compact && <div className="section-heading"><div className="eyebrow dark"><span>01</span> CREATE YOUR PATH</div><h2>What would you like<br />to <em>get good at?</em></h2><p>A few thoughtful inputs make a dramatically better course.</p></div>}
      <div className="planner-card"><div className="planner-steps"><span className="current">1. Your goal</span><i /><span>2. Your context</span><i /><span>3. Sources</span></div><form onSubmit={buildPath}>
        {isSourceDriven ? <div className="source-driven-planner"><span>CONTENT-DRIVEN COURSE</span><strong>Building from your prepared material</strong><p>{topic}</p><small>Varen is using your resource as the syllabus. No extra setup needed.</small></div> : <>
          <label htmlFor="topic">I want to learn</label>
          <div className="topic-input"><input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} /><button type="submit" aria-label="Generate path" disabled={isGenerating}>→</button></div>
          <div className="chips">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setTopic(suggestion)}>{suggestion}</button>)}</div>
          <div className="planner-options"><label><span>My current level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option>Some experience</option><option>Just getting started</option><option>Comfortable / advanced</option></select></label><label><span>Time I can give it</span><select value={timePerDay} onChange={(event) => setTimePerDay(event.target.value)}><option>20 minutes a day</option><option>10 minutes a day</option><option>45 minutes a day</option></select></label></div>
          <div className="source-row"><div><span className="source-icon">⤓</span><p><strong>Add learning context (optional)</strong><small>Read a web page, paste notes, or add a PDF, Word, or text document</small></p></div><button type="button" className="add-source" onClick={() => setSourceInputOpen((open) => !open)}>{sourceInputOpen ? 'Close' : 'Add a source +'}</button></div>
          {sourceInputOpen && <div className="source-input"><select value={sourceType} onChange={(event) => setSourceType(event.target.value as 'link' | 'note' | 'file')}><option value="link">Web page</option><option value="note">My note</option><option value="file">PDF, Word, or text document</option></select>{sourceType === 'link' ? <input value={sourceValue} onChange={(event) => setSourceValue(event.target.value)} placeholder="https://example.com/article" /> : sourceType === 'note' ? <textarea value={sourceValue} onChange={(event) => setSourceValue(event.target.value)} placeholder="Paste your key notes, requirements, or outline..." rows={3} /> : <label className="file-source-input"><input type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => void addDocument(event.target.files?.[0])} /><span>{isIngesting ? 'Reading document…' : 'Choose a PDF, Word, or text document'}<small>Up to {MAX_DOCUMENT_MB} MB · balanced excerpts from the full document</small></span></label>}{sourceType !== 'file' && <button type="button" onClick={() => void addSource()} disabled={isIngesting}>{isIngesting ? 'Reading…' : 'Add'}</button>}</div>}
          {sources.length > 0 && <ul className="source-list">{sources.map((source, index) => <li key={`${source.label}-${index}`}><span>{source.sourceType === 'link' ? '↗' : '✎'}</span><p>{source.label}<small>{source.sourceType === 'link' ? `${source.url} · readable excerpt added` : `${source.sourceText?.length ?? 0} characters added`}</small></p><button type="button" aria-label={`Remove ${source.label}`} onClick={() => setSources((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul>}
          <button className="primary-button full" type="submit" disabled={isGenerating}>{isGenerating ? 'Designing a path around your goals…' : <>Create my learning path <span>→</span></>}</button>
        </>}
        {error && <p className="planner-error" role="alert">{error}</p>}
      </form></div>
    </section>
    {draft && <section className="path-preview" id="preview"><div className="preview-top"><div><div className="eyebrow dark"><span>02</span> YOUR LEARNING PATH</div><h2>{draft.title}</h2><p>{draft.summary}</p></div><div className="source-confidence"><span>{draft.modules.length}</span><p>learning modules<br /><small>~{draft.estimatedMinutes} minutes total{sources.length ? ` · ${sources.length} source${sources.length === 1 ? '' : 's'}` : ''}</small></p></div></div><div className="preview-grid"><article className="roadmap-card"><div className="roadmap-head"><span>{draft.modules.length} modules · ~{draft.estimatedMinutes} min</span><button type="button">Edit path</button></div>{modules.map((module) => <div className="roadmap-module" key={module.number}><b>{module.number}</b><div><strong>{module.title}</strong><small>{module.description} · {module.estimatedMinutes} min</small></div><button type="button" aria-label={`Edit ${module.title}`}>⋮</button></div>)}<button type="button" className="outline-add">+ Add a module</button></article><aside className="coach-card"><div className="coach-head"><span className="coach-avatar">✦</span><div><strong>Your learning coach</strong><small>Ready to shape the plan with you</small></div></div><div className="coach-message" aria-live="polite">{coachFeedback}</div><div className="coach-suggestions"><button type="button" onClick={() => refinePath('Make the course more hands-on. Include practical exercises and real-world application in every module.')} disabled={isCoaching}>Focus on practice</button><button type="button" onClick={() => refinePath('Make the course shorter and more focused, while preserving the essential concepts.')} disabled={isCoaching}>Make it shorter</button><button type="button" onClick={addSourceFromCoach} disabled={isCoaching}>Add a source</button></div><label><input aria-label="Message your learning coach" value={coachRequest} onChange={(event) => setCoachRequest(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void refinePath(coachRequest); } }} placeholder="Tell the coach what to change..." disabled={isCoaching} /><button type="button" aria-label="Send request to learning coach" onClick={() => refinePath(coachRequest)} disabled={isCoaching || !coachRequest.trim()}>{isCoaching ? '…' : '↑'}</button></label></aside></div><button className="primary-button start-path" type="button" onClick={savePath} disabled={isSaving}>{isSaving ? 'Saving your path…' : <>Start learning this path <span>→</span></>}</button>{error && <p className="planner-error" role="alert">{error}</p>}</section>}
  </>;
}
