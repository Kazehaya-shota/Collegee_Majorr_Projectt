'use client';

/* eslint-disable @next/next/no-img-element -- Licensed Openverse URLs are dynamic and intentionally rendered without proxying. */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressLoader } from '@/components/progress-loader';

type PublicLesson = {
  lesson: { introduction: string; sections: Array<{ heading: string; content: string }>; keyTakeaways: string[]; practicePrompt: string };
  quiz: Array<{ question: string; options: string[]; explanation: string }>;
};

type ResourcePack = {
  images: Array<{ imageUrl: string; title: string; creator: string; license: string; licenseUrl: string | null; sourceUrl: string | null }>;
  videos: Array<{ title: string; channel: string; thumbnail: string | null; url: string }>;
  fallbackVideoSearch: string;
  blogs: Array<{ title: string; description: string; url: string }>;
};

type QuizResult = { score: number; passed: boolean; earnedXp: number; explanations: Array<{ correct: boolean; explanation: string }> };

export function ModuleLessonPlayer({ courseId, moduleId, initialCompleted }: { courseId: string; moduleId: string; initialCompleted: boolean }) {
  const router = useRouter();
  const [content, setContent] = useState<PublicLesson | null>(null);
  const [resources, setResources] = useState<ResourcePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [quizStarted, setQuizStarted] = useState(initialCompleted);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/modules/${moduleId}/lesson`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const payload = await response.json() as PublicLesson & { error?: string };
        if (!response.ok || !payload.lesson || !payload.quiz) throw new Error(payload.error || 'Lesson generation failed.');
        setContent({ lesson: payload.lesson, quiz: payload.quiz });
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'We could not prepare this lesson.');
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, [moduleId]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/modules/${moduleId}/resources`);
        const payload = await response.json() as ResourcePack & { error?: string };
        if (!response.ok) throw new Error(payload.error || 'Resource loading failed.');
        setResources(payload);
      } catch {
        // Resources are supplemental. The lesson remains fully usable if one provider is unavailable.
      } finally {
        setResourceLoading(false);
      }
    })();
  }, [moduleId]);

  async function completeLesson() {
    setCompleting(true);
    setError('');
    try {
      const response = await fetch(`/api/modules/${moduleId}/progress`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed' }) });
      const payload = await response.json() as { error?: string; earnedXp?: number };
      if (!response.ok) throw new Error(payload.error || 'Progress could not be updated.');
      setIsCompleted(true);
      setQuizStarted(true);
      setMessage(payload.earnedXp ? `Lesson complete — ${payload.earnedXp} XP added. Now finish the quiz.` : 'Lesson complete — your quiz is ready.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Progress could not be updated.');
    } finally {
      setCompleting(false);
    }
  }

  async function submitQuiz() {
    if (!content) return;
    if (answers.length !== content.quiz.length || answers.some((answer) => !Number.isInteger(answer))) {
      setError('Choose an answer for every question before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/modules/${moduleId}/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
      const payload = await response.json() as QuizResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Quiz submission failed.');
      setResult(payload);
      if (payload.passed) {
        setMessage(`Quiz passed — ${payload.earnedXp} XP earned. Returning to your learning path…`);
        redirectTimer.current = setTimeout(() => router.push(`/courses/${courseId}`), 1600);
      } else {
        setMessage('Keep practising — review the lesson, then try the quiz again.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Quiz submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <section className="lesson-reader-state"><ProgressLoader title="Building your detailed lesson" detail="Gathering the explanation, visuals, practice, and quiz in one focused space." /></section>;
  if (!content) return <section className="lesson-reader-state is-error"><strong>We could not open this lesson.</strong><p>{error || 'Please return to your learning path and try again.'}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section>;

  return <section className="lesson-reader">{(completing || submitting) && <ProgressLoader compact title={completing ? 'Saving your lesson progress' : 'Scoring your quiz'} detail={completing ? 'Adding this learning milestone to your path.' : 'Checking your understanding and calculating XP.'} />}<article className="lesson-content"><p className="lesson-intro">{content.lesson.introduction}</p>{resources?.images.length ? <div className="lesson-visuals">{resources.images.map((image) => <figure key={image.imageUrl}><img src={image.imageUrl} alt={image.title} /><figcaption>{image.sourceUrl ? <a href={image.sourceUrl} target="_blank" rel="noreferrer">{image.title}</a> : image.title}<small>by {image.creator} · {image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a> : image.license}</small></figcaption></figure>)}</div> : null}{content.lesson.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2><p>{section.content}</p></section>)}<aside><strong>Key takeaways</strong><ul>{content.lesson.keyTakeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul></aside><div className="practice-card"><span>TRY IT</span><p>{content.lesson.practicePrompt}</p></div></article><LessonResources resources={resources} loading={resourceLoading} />{!isCompleted ? <div className="lesson-finish"><div><span>READY TO MOVE ON?</span><h2>Complete the lesson, then prove it in the quiz.</h2><p>Finishing this lesson grants 50 XP and opens its module quiz here.</p></div><button type="button" onClick={completeLesson} disabled={completing}>{completing ? 'Saving progress…' : 'Complete lesson →'}</button></div> : quizStarted ? <section className="module-quiz"><p className="eyebrow"><span>MODULE QUIZ</span> {content.quiz.length} QUESTIONS</p><h2>Put the lesson into practice</h2>{content.quiz.map((question, questionIndex) => <fieldset key={question.question} disabled={Boolean(result)}><legend>{questionIndex + 1}. {question.question}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`${moduleId}-${questionIndex}`} checked={answers[questionIndex] === optionIndex} onChange={() => setAnswers((current) => { const next = [...current]; next[questionIndex] = optionIndex; return next; })} />{option}</label>)}{result && <p className={result.explanations[questionIndex]?.correct ? 'correct-answer' : 'incorrect-answer'}>{result.explanations[questionIndex]?.correct ? 'Correct. ' : 'Review: '}{result.explanations[questionIndex]?.explanation}</p>}</fieldset>)}{result ? <div className="quiz-result"><strong>{result.score}% · {result.passed ? 'Passed!' : 'Keep practising'}</strong><p>{result.passed ? 'Taking you back to your learning path…' : 'Review the lesson above, then return when you are ready to try again.'}</p>{!result.passed && <button type="button" onClick={() => { setResult(null); setAnswers([]); }}>Try quiz again</button>}</div> : <button className="submit-module-quiz" type="button" onClick={submitQuiz} disabled={submitting}>{submitting ? 'Scoring your answers…' : `Submit ${content.quiz.length}-question quiz`}</button>}</section> : null}{message && <p className="learning-message" role="status">✦ {message}</p>}{error && <p className="planner-error" role="alert">{error}</p>}</section>;
}

function LessonResources({ resources, loading }: { resources: ResourcePack | null; loading: boolean }) {
  if (loading) return <section className="module-resources is-loading"><span className="pulse" /> Finding helpful videos and reading…</section>;
  if (!resources) return null;
  return <section className="module-resources"><div><p className="eyebrow dark"><span>KEEP EXPLORING</span> CURATED FOR THIS MODULE</p><h2>Go deeper when you are ready.</h2></div>{resources.videos.length > 0 ? <div className="resource-video-grid">{resources.videos.map((video) => <a key={video.url} href={video.url} target="_blank" rel="noreferrer">{video.thumbnail && <img src={video.thumbnail} alt="" />}<span>WATCH ON YOUTUBE</span><strong>{video.title}</strong><small>{video.channel}</small></a>)}</div> : <a className="youtube-search-card" href={resources.fallbackVideoSearch} target="_blank" rel="noreferrer"><span>YOUTUBE</span><strong>Find a tutorial matched to this module →</strong><small>Opens a focused YouTube search.</small></a>}<div className="resource-blog-grid">{resources.blogs.map((blog) => <a key={blog.url} href={blog.url} target="_blank" rel="noreferrer"><span>READ</span><strong>{blog.title}</strong><small>{blog.description}</small></a>)}</div><small className="resource-note">Images are supplied by Openverse with creator and licence attribution. Video suggestions are live when a YouTube API key is configured.</small></section>;
}
