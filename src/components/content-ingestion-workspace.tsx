'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CourseSource } from '@/lib/course-sources';
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_MB, documentContext, readDocument } from '@/lib/document-ingestion';
import { ProgressLoader } from '@/components/progress-loader';

type Summary = { title: string; overview: string; concepts: Array<{ heading: string; content: string }>; takeaways: string[]; quiz: Array<{ question: string; options: string[]; explanation: string }> };
type QuizResult = { score: number; correct: boolean[] };

export function ContentIngestionWorkspace() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<'link' | 'note' | 'file'>('link');
  const [value, setValue] = useState('');
  const [sources, setSources] = useState<CourseSource[]>([]);
  const [studyFocus, setStudyFocus] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');

  async function addSource() {
    const text = value.trim();
    if (!text) return;
    if (sources.length >= 5) { setError('You can prepare up to five sources for one course.'); return; }
    if (sourceType === 'note') {
      setSources((current) => [...current, { sourceType: 'note', label: `Your note ${current.length + 1}`, sourceText: documentContext(text) }]);
      setValue(''); setError(''); return;
    }
    try {
      const url = new URL(text);
      setIsReading(true); setError('');
      const response = await fetch('/api/ingest/web', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.toString() }) });
      const payload = await response.json() as { label?: string; url?: string; sourceText?: string; error?: string };
      if (!response.ok || !payload.label || !payload.url || !payload.sourceText) throw new Error(payload.error || 'This web page could not be read.');
      setSources((current) => [...current, { sourceType: 'link', label: payload.label!, url: payload.url!, sourceText: payload.sourceText! }]);
      setValue('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not read that page.');
    } finally { setIsReading(false); }
  }

  async function addFile(file: File | undefined) {
    if (!file) return;
    if (sources.length >= 5) { setError('You can prepare up to five sources for one course.'); return; }
    try {
      setIsReading(true); setError('');
      const sourceText = await readDocument(file);
      if (sourceText.length < 40) throw new Error('That document does not contain enough readable text.');
      setSources((current) => [...current, { sourceType: 'note', label: file.name, sourceText }]);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'We could not read that document.');
    } finally { setIsReading(false); }
  }

  async function summarize() {
    if (!sources.length) { setError('Add at least one source first.'); return; }
    setIsSummarizing(true); setError(''); setQuizStarted(false); setQuizResult(null);
    try {
      const response = await fetch('/api/ingest/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources, focus: studyFocus }) });
      const payload = await response.json() as { summary?: Summary; answers?: number[]; error?: string };
      if (!response.ok || !payload.summary || !payload.answers) throw new Error(payload.error || 'Material summarization failed.');
      setSummary(payload.summary); setCorrectAnswers(payload.answers); setAnswers([]);
      setTimeout(() => document.querySelector('#source-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : 'We could not summarize this material.');
    } finally { setIsSummarizing(false); }
  }

  function useInGenerator() {
    if (!sources.length) { setError('Add at least one source first.'); return; }
    window.sessionStorage.setItem('zentrix-ingestion-sources', JSON.stringify(sources));
    router.push('/dashboard/course-generator');
  }

  function submitQuiz() {
    if (!summary) return;
    if (answers.length !== summary.quiz.length || answers.some((answer) => !Number.isInteger(answer))) { setError('Choose an answer for every question before viewing results.'); return; }
    const correct = answers.map((answer, index) => answer === correctAnswers[index]);
    setQuizResult({ correct, score: Math.round((correct.filter(Boolean).length / correct.length) * 100) });
  }

  const hasPdfSource = sources.some((source) => /\.pdf$/i.test(source.label));

  return <section className="ingestion-workspace">
    <div className="ingestion-steps"><span className="is-current">1. Bring material</span><i /><span>2. Choose your outcome</span><i /><span>3. Learn or build</span></div>
    {(isReading || isSummarizing) && <ProgressLoader title={isSummarizing ? 'Turning material into a study guide' : 'Reading your learning material'} detail={isSummarizing ? 'Organizing key concepts and preparing the quiz.' : 'Extracting the most useful context across your source.'} />}
    <div className="ingestion-intake"><div><label htmlFor="ingestion-source-type">What are you bringing in?</label><select id="ingestion-source-type" value={sourceType} onChange={(event) => setSourceType(event.target.value as 'link' | 'note' | 'file')}><option value="link">A web page or article</option><option value="note">My notes or chapter text</option><option value="file">A PDF, Word, or text document</option></select></div>{sourceType === 'link' ? <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://example.com/article" /> : sourceType === 'note' ? <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={7} placeholder="Paste notes, a chapter outline, class requirements, or any text you want Zentrix to understand…" /> : <label className="ingestion-file"><input type="file" accept={DOCUMENT_ACCEPT} onChange={(event) => void addFile(event.target.files?.[0])} /><strong>{isReading ? 'Reading your document…' : 'Choose a document'}</strong><small>PDF, Word (.docx), .txt, .md, .csv, or .json · up to {MAX_DOCUMENT_MB} MB</small></label>}{sourceType !== 'file' && <button type="button" onClick={() => void addSource()} disabled={isReading}>{isReading ? 'Extracting context…' : sourceType === 'link' ? 'Read this page →' : 'Add this text →'}</button>}</div>
    <aside className="ingestion-note"><span>HOW IT WORKS</span><p>Zentrix keeps a focused, balanced set of excerpts from your material so the AI can work with it meaningfully.</p><small>For long documents, it samples across the whole file—not only the first page.</small></aside>
    {sources.length > 0 && <div className="ingestion-results">
      <header><div><span>{String(sources.length).padStart(2, '0')}</span><h2>Materials ready</h2></div></header>
      <div>{sources.map((source, index) => <article key={`${source.label}-${index}`}><span>{source.sourceType === 'link' ? '↗' : '✎'}</span><div><strong>{source.label}</strong><small>{source.sourceType === 'link' ? `${source.url} · ${source.sourceText?.length ?? 0} characters extracted` : `${source.sourceText?.length ?? 0} characters prepared`}</small></div><button type="button" aria-label={`Remove ${source.label}`} onClick={() => setSources((current) => current.filter((_, sourceIndex) => sourceIndex !== index))}>×</button></article>)}</div>
      {hasPdfSource && <section className="ingestion-focus-card"><div><span>OPTIONAL STUDY FOCUS</span><strong>Summarize one topic from this PDF.</strong><p>For example: “only the cardiovascular system chapter” or “explain photosynthesis and its stages.”</p></div><textarea value={studyFocus} maxLength={360} onChange={(event) => setStudyFocus(event.target.value)} placeholder="What should this PDF summary focus on?" rows={3} /></section>}
      <div className="ingestion-choice"><div><span>CHOOSE YOUR NEXT STEP</span><h2>How would you like to use this material?</h2><p>Study the core concepts now, or turn the same context into a full learning path.</p></div><div><button type="button" className="ingestion-summary-action" onClick={() => void summarize()} disabled={isSummarizing}>{isSummarizing ? 'Creating your summary…' : studyFocus.trim() ? 'Summarize this topic + quiz' : 'Summarize concepts + quiz'}</button><button type="button" onClick={useInGenerator}>Use in AI Course Generation →</button></div></div>
    </div>}
    {summary && <section className="ingestion-summary" id="source-summary"><p className="eyebrow dark"><span>SOURCE SUMMARY</span> CONCEPT REVIEW</p><h2>{summary.title}</h2><p className="ingestion-summary-overview">{summary.overview}</p>{summary.concepts.map((concept) => <article key={concept.heading}><h3>{concept.heading}</h3><p>{concept.content}</p></article>)}<aside><strong>Key takeaways</strong><ul>{summary.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul></aside>{!quizStarted ? <div className="ingestion-quiz-start"><div><span>SUMMARY COMPLETE</span><strong>Ready for a {summary.quiz.length}-question concept quiz?</strong><small>Check your understanding before you move on.</small></div><button type="button" onClick={() => setQuizStarted(true)}>Start quiz →</button></div> : <section className="ingestion-quiz"><p className="eyebrow"><span>CONCEPT QUIZ</span> {summary.quiz.length} QUESTIONS</p>{summary.quiz.map((question, questionIndex) => <fieldset key={question.question} disabled={Boolean(quizResult)}><legend>{questionIndex + 1}. {question.question}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`source-${questionIndex}`} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers((current) => { const next = [...current]; next[questionIndex] = optionIndex; return next; })} />{option}</label>)}{quizResult && <p className={quizResult.correct[questionIndex] ? 'correct-answer' : 'incorrect-answer'}>{quizResult.correct[questionIndex] ? 'Correct. ' : 'Review: '}{question.explanation}</p>}</fieldset>)}{quizResult ? <div className="quiz-result"><strong>{quizResult.score}% · {quizResult.score >= 67 ? 'Great work!' : 'Keep revising'}</strong><p>{quizResult.score >= 67 ? 'You have a solid grasp of these source concepts.' : 'Review the concepts above, then try again when you are ready.'}</p>{quizResult.score < 67 && <button type="button" onClick={() => { setQuizResult(null); setAnswers([]); }}>Try quiz again</button>}</div> : <button type="button" className="submit-module-quiz" onClick={submitQuiz}>Submit concept quiz</button>}</section>}</section>}
    {error && <p className="planner-error" role="alert">{error}</p>}
  </section>;
}
