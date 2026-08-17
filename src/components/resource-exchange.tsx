'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { readDocument } from '@/lib/document-ingestion';
import { ProgressLoader } from '@/components/progress-loader';

type ResourceComment = { id: string; body: string; isMine: boolean };
type SharedResource = { id: string; title: string; description: string; subject: string; tags: string[]; type: 'PDF' | 'Document' | 'Slides' | 'Data' | 'Notes' | 'Image' | 'Link'; originalName: string | null; fileSize: number | null; createdAt: string; href: string | null; isMine: boolean; saved: boolean; saves: number; helpful: boolean; helpfuls: number; comments: ResourceComment[] };
type LibraryPayload = { resources: SharedResource[]; error?: string };

const BUCKET = 'community-resources';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const RESOURCE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp';

function formatSize(value: number | null) {
  if (!value) return 'Web resource';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function resourceIcon(type: SharedResource['type']) {
  return type === 'PDF' ? 'PDF' : type === 'Image' ? '▧' : type === 'Link' ? '↗' : type === 'Slides' ? '▤' : type === 'Data' ? '⌁' : type === 'Document' ? '≡' : '✎';
}

export function ResourceExchange() {
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [moderationBlocked, setModerationBlocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'All' | SharedResource['type']>('All');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [openComments, setOpenComments] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/resources');
      const payload = await response.json() as LibraryPayload;
      if (!response.ok) throw new Error(payload.error || 'We could not open Resource Exchange.');
      setResources(payload.resources ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not open Resource Exchange.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleResources = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources.filter((resource) => (filter === 'All' || resource.type === filter) && (!term || `${resource.title} ${resource.subject} ${resource.description} ${resource.tags.join(' ')}`.toLowerCase().includes(term)));
  }, [resources, query, filter]);

  async function action(actionName: string, values: Record<string, unknown>) {
    setBusy(actionName); setError(''); setNotice(''); setModerationBlocked(false);
    try {
      const response = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, ...values }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'That resource update could not be saved.');
      await load();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'That resource update could not be saved.');
      return false;
    } finally { setBusy(''); }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) { setError('Choose a resource file first.'); return; }
    if (selectedFile.size > MAX_FILE_BYTES) { setError('Resources can be up to 50 MB.'); return; }
    const form = new FormData(event.currentTarget);
    setBusy('upload_file'); setError(''); setNotice(''); setModerationBlocked(false); setUploadProgress(12);
    try {
      let moderationText = '';
      try { moderationText = await readDocument(selectedFile); } catch { /* A final server-side review will keep unreviewable files private. */ }
      const prepareResponse = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create_upload', title: form.get('title'), subject: form.get('subject'), description: form.get('description'), tags: form.get('tags'), originalName: selectedFile.name, size: selectedFile.size, moderationText }) });
      const prepared = await prepareResponse.json() as { resourceId?: string; path?: string; token?: string; contentType?: string; error?: string; blocked?: boolean };
      if (prepared.blocked) setModerationBlocked(true);
      if (!prepareResponse.ok || !prepared.resourceId || !prepared.path || !prepared.token || !prepared.contentType) throw new Error(prepared.error || 'We could not prepare your upload.');
      setUploadProgress(36);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error('Resource uploads are not configured yet.');
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(prepared.path, prepared.token, selectedFile, { contentType: prepared.contentType });
      if (uploadError) throw uploadError;
      setUploadProgress(82);
      const publishResponse = await fetch('/api/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'publish_upload', resourceId: prepared.resourceId }) });
      const published = await publishResponse.json() as { error?: string; blocked?: boolean };
      if (published.blocked) setModerationBlocked(true);
      if (!publishResponse.ok) throw new Error(published.error || 'The upload could not be published.');
      setUploadProgress(100); setSelectedFile(null); setShowUpload(false); setNotice('Your resource is now available to the Varen community.');
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'We could not upload that resource.');
    } finally { setBusy(''); window.setTimeout(() => setUploadProgress(0), 900); }
  }

  async function shareLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await action('create_link', { title: form.get('title'), subject: form.get('subject'), description: form.get('description'), tags: form.get('tags'), url: form.get('url') });
    if (saved) { setShowUpload(false); setNotice('Your resource link is now available to the community.'); }
  }

  async function sendComment(event: FormEvent<HTMLFormElement>, resourceId: string) {
    event.preventDefault();
    const content = commentDrafts[resourceId] ?? '';
    const saved = await action('comment_resource', { resourceId, content });
    if (saved) setCommentDrafts((current) => ({ ...current, [resourceId]: '' }));
  }

  return <section className="resource-exchange">
    <header className="resource-hero"><div><p className="eyebrow dark"><span>RESOURCE EXCHANGE</span> SHARED BY LEARNERS, FOR LEARNERS</p><h1>Share what got you <em>unstuck.</em></h1><p>Open up your notes, useful links, revision decks, and resources that can make someone else&apos;s learning lighter.</p></div><aside><span>▤</span><strong>{resources.length} shared resource{resources.length === 1 ? '' : 's'}</strong><p>Built by the people learning alongside you.</p><button onClick={() => setShowUpload((current) => !current)}>+ Share a resource</button></aside></header>
    <section className="resource-library"><header className="resource-library-head"><div><span>THE COMMUNITY LIBRARY</span><h2>Find the good <em>stuff.</em></h2></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, subjects, tags…" aria-label="Search shared resources" /></label></header>
      <div className="resource-filters">{(['All', 'PDF', 'Document', 'Slides', 'Data', 'Notes', 'Image', 'Link'] as const).map((item) => <button key={item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item === 'All' ? 'All resources' : item}</button>)}</div>
      {showUpload && <section className="resource-upload"><header><div><span>SHARE WITH THE COMMUNITY</span><h3>{uploadMode === 'file' ? 'Upload a resource.' : 'Share a useful link.'}</h3></div><div><button className={uploadMode === 'file' ? 'is-active' : ''} onClick={() => setUploadMode('file')}>File</button><button className={uploadMode === 'link' ? 'is-active' : ''} onClick={() => setUploadMode('link')}>Link</button></div></header>{uploadMode === 'file' ? <form onSubmit={uploadFile}><input name="title" placeholder="Resource title" required maxLength={120} /><input name="subject" placeholder="Subject or topic — e.g. Database Systems" required maxLength={80} /><input name="tags" placeholder="Tags — e.g. DBMS, SQL, semester 4" maxLength={300} /><label className="resource-file-picker"><input type="file" accept={RESOURCE_ACCEPT} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /><span><b>{selectedFile ? selectedFile.name : 'Choose a PDF, document, slides, data file, image, or notes'}</b><small>{selectedFile ? `${formatSize(selectedFile.size)} ready to share` : 'Up to 50 MB · visible to signed-in Varen learners'}</small></span></label><textarea name="description" placeholder="What is useful about this resource? (optional)" maxLength={600} rows={3} />{busy === 'upload_file' && <div className="resource-upload-progress"><i><b style={{ width: `${uploadProgress}%` }} /></i><span>Sharing resource · {uploadProgress}%</span></div>}<button disabled={busy === 'upload_file'}>{busy === 'upload_file' ? 'Sharing…' : 'Publish resource →'}</button></form> : <form onSubmit={shareLink}><input name="title" placeholder="Resource title" required maxLength={120} /><input name="subject" placeholder="Subject or topic" required maxLength={80} /><input name="tags" placeholder="Tags — e.g. web development, CSS" maxLength={300} /><input name="url" type="url" placeholder="https://…" required maxLength={1200} /><textarea name="description" placeholder="Why should learners open this? (optional)" maxLength={600} rows={3} /><button disabled={busy === 'create_link'}>{busy === 'create_link' ? 'Publishing…' : 'Publish link →'}</button></form>}</section>}
      {loading ? <ProgressLoader title="Opening Resource Exchange" detail="Gathering notes, resources, and helpful links from the community." /> : <>{notice && <p className="resource-notice">✦ {notice}</p>}<div className="resource-grid">{visibleResources.length ? visibleResources.map((resource) => <article key={resource.id}><header><span className={`resource-type resource-${resource.type.toLowerCase()}`}>{resourceIcon(resource.type)}</span><div><small>{resource.type} · {formatSize(resource.fileSize)}</small><h3>{resource.title}</h3><p>{resource.subject}</p></div>{resource.isMine && <b>YOU SHARED</b>}</header>{resource.description && <p className="resource-description">{resource.description}</p>}{resource.tags.length > 0 && <div className="resource-tags">{resource.tags.map((tag) => <i key={tag}>#{tag}</i>)}</div>}<footer><div><button className={resource.helpful ? 'is-active' : ''} onClick={() => void action('toggle_helpful', { resourceId: resource.id })}>✦ {resource.helpfuls || ''} Helpful</button><button className={resource.saved ? 'is-active' : ''} onClick={() => void action('toggle_save', { resourceId: resource.id })}>⌑ {resource.saves || ''} Save</button><button onClick={() => setOpenComments((current) => current === resource.id ? '' : resource.id)}>◌ {resource.comments.length || ''} Discuss</button></div>{resource.href ? <a href={resource.href} target="_blank" rel="noreferrer">Open ↗</a> : <span>Preparing…</span>}</footer>{openComments === resource.id && <section className="resource-comments">{resource.comments.length ? resource.comments.map((comment) => <p key={comment.id}><b>{comment.isMine ? 'You' : 'Learner'}</b>{comment.body}</p>) : <small>Be the first to add a helpful note.</small>}<form onSubmit={(event) => void sendComment(event, resource.id)}><input value={commentDrafts[resource.id] ?? ''} onChange={(event) => setCommentDrafts((current) => ({ ...current, [resource.id]: event.target.value }))} placeholder="Add a useful comment…" maxLength={1200} /><button disabled={busy === 'comment_resource'}>Post</button></form></section>}</article>) : <div className="resource-empty"><span>▤</span><strong>Nothing matches yet.</strong><p>Try another search, or share the resource your classmates should have.</p><button onClick={() => setShowUpload(true)}>Share the first resource →</button></div>}</div></>}
      {moderationBlocked && <p className="resource-moderation-card" role="alert">This resource can’t be shared because it may not be appropriate for Varen.</p>}
      {error && <p className="resource-error" role="alert">{error}</p>}
    </section>
  </section>;
}
