'use client';

/* eslint-disable @next/next/no-img-element -- YouTube thumbnail hosts are dynamic and are intentionally not proxied. */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CourseSource } from '@/lib/course-sources';
import { ProgressLoader } from '@/components/progress-loader';

type YouTubeSource = { type: 'video' | 'playlist'; title: string; channel: string; thumbnail: string | null; videoCount: number; source: CourseSource };

export function YouTubeCourseWorkspace() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<YouTubeSource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function inspectLink() {
    if (!url.trim()) return;
    setIsLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/ingest/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const payload = await response.json() as YouTubeSource & { error?: string };
      if (!response.ok || !payload.source) throw new Error(payload.error || 'YouTube could not read that link.');
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'YouTube could not read that link.');
    } finally { setIsLoading(false); }
  }

  function createCourse() {
    if (!result) return;
    window.sessionStorage.setItem('coursemaster-ingestion-sources', JSON.stringify([result.source]));
    router.push('/dashboard/course-generator');
  }

  return <section className="youtube-workspace"><div className="youtube-intake"><p className="eyebrow dark"><span>PUBLIC VIDEO OR PLAYLIST</span> YOUTUBE TO COURSE</p><h2>Paste what you want to learn from.</h2><p>CourseMaster reads the public title, description, and playlist structure, then turns that context into a course.</p><div><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=… or playlist?list=…" onKeyDown={(event) => { if (event.key === 'Enter') void inspectLink(); }} /><button type="button" onClick={() => void inspectLink()} disabled={isLoading}>{isLoading ? 'Reading YouTube…' : 'Read link →'}</button></div><small>Works with public YouTube videos, Shorts, and playlists.</small></div>{isLoading && <ProgressLoader title="Mapping this learning source" detail="Reading the public video details and shaping its learning context." />}{result && <article className="youtube-preview">{result.thumbnail && <img src={result.thumbnail} alt="" />}<div><span>{result.type === 'playlist' ? `${result.videoCount} VIDEO PLAYLIST` : 'YOUTUBE VIDEO'}</span><h2>{result.title}</h2><p>by {result.channel}</p><small>CourseMaster will use the public metadata and descriptions from this {result.type} as its learning context.</small><button type="button" onClick={createCourse}>Create course from this {result.type} →</button></div></article>}{error && <p className="planner-error" role="alert">{error}</p>}<aside className="youtube-note"><strong>What this uses</strong><p>YouTube provides public video and playlist metadata through its official API. For a richer course, choose videos or playlists with detailed descriptions.</p></aside></section>;
}
