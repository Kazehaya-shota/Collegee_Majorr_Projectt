'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ProgressLoader } from '@/components/progress-loader';

type Group = { id: string; title: string; topic: string; description: string; visibility: 'public' | 'private'; capacity: number; members: number };
type Room = { id: string; title: string; topic: string; description: string; posts: number };
type Resource = { id: string; title: string; subject: string; resource_type: 'file' | 'link'; status: 'uploading' | 'published' };
type Report = { id: string; target_type: string; target_id: string; target_label: string; reason: string; details: string; status: 'open' | 'resolved' | 'removed'; created_at: string };
type AdminData = { groups: Group[]; rooms: Room[]; resources: Resource[]; reports: Report[]; error?: string };

const emptyData: AdminData = { groups: [], rooms: [], resources: [], reports: [] };

export function SpaceAdmin() {
  const [data, setData] = useState<AdminData>(emptyData);
  const [tab, setTab] = useState<'overview' | 'content' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/community/admin');
      const payload = await response.json() as AdminData;
      if (!response.ok) throw new Error(payload.error || 'We could not open Space Admin.');
      setData({ groups: payload.groups ?? [], rooms: payload.rooms ?? [], resources: payload.resources ?? [], reports: payload.reports ?? [] });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not open Space Admin.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function action(actionName: string, values: Record<string, unknown>, success: string) {
    setBusy(actionName); setError(''); setNotice('');
    try {
      const response = await fetch('/api/community/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, ...values }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'We could not update your Community Space.');
      setEditing(''); setNotice(success); await load();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update your Community Space.');
      return false;
    } finally { setBusy(''); }
  }

  async function updateGroup(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action('update_group', { id, title: form.get('title'), topic: form.get('topic'), description: form.get('description'), visibility: form.get('visibility'), capacity: form.get('capacity') }, 'Study group updated.');
  }

  async function updateRoom(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action('update_room', { id, title: form.get('title'), topic: form.get('topic'), description: form.get('description') }, 'Study room updated.');
  }

  function confirmDelete(actionName: string, id: string, label: string) {
    if (window.confirm(`Delete ${label}? This cannot be undone.`)) void action(actionName, { id }, `${label} deleted.`);
  }

  const openReports = data.reports.filter((report) => report.status === 'open');

  return <section className="space-admin">
    <header className="space-admin-hero"><div><p className="eyebrow dark"><span>SPACE ADMIN</span> YOUR COMMUNITY, YOUR STANDARD</p><h1>Keep your space<br /><em>worth joining.</em></h1><p>Manage what you created, review concerns, and keep learning conversations useful and respectful.</p></div><aside><span>◈</span><strong>{openReports.length} open concern{openReports.length === 1 ? '' : 's'}</strong><p>{data.groups.length + data.rooms.length + data.resources.length} items under your care.</p></aside></header>
    <nav className="space-admin-tabs" aria-label="Space Admin sections"><button className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'content' ? 'is-active' : ''} onClick={() => setTab('content')}>Manage content</button><button className={tab === 'reports' ? 'is-active' : ''} onClick={() => setTab('reports')}>Moderation queue {openReports.length > 0 && <b>{openReports.length}</b>}</button></nav>
    {loading ? <ProgressLoader title="Opening Space Admin" detail="Gathering your groups, rooms, shared resources, and moderation queue." /> : <>{notice && <p className="space-admin-notice">✦ {notice}</p>}{tab === 'overview' && <section className="space-admin-overview"><div className="space-admin-stats"><article><span>◉</span><strong>{data.groups.length}</strong><small>study groups</small></article><article><span>◌</span><strong>{data.rooms.length}</strong><small>study rooms</small></article><article><span>▤</span><strong>{data.resources.length}</strong><small>shared resources</small></article><article><span>⚐</span><strong>{openReports.length}</strong><small>open reports</small></article></div><section className="space-admin-priority"><span>✦</span><div><small>YOUR NEXT ADMIN MOVE</small><h2>{openReports.length ? 'A learner needs your attention.' : 'Your Community Space is in good shape.'}</h2><p>{openReports.length ? 'Review the moderation queue, then decide whether to keep or remove the reported content.' : 'As learners join, this is where you can keep rooms, groups, and resources clear and useful.'}</p></div><button onClick={() => setTab(openReports.length ? 'reports' : 'content')}>{openReports.length ? 'Review reports →' : 'Manage content →'}</button></section></section>}{tab === 'content' && <section className="space-admin-content"><header><div><span>WHAT YOU OWN</span><h2>Edit with purpose. <em>Delete with confidence.</em></h2></div></header><div className="admin-content-grid"><section><h3>Study groups <small>{data.groups.length}</small></h3>{data.groups.length ? data.groups.map((group) => <article key={group.id}><header><span>◉</span><div><strong>{group.title}</strong><small>{group.topic} · {group.members}/{group.capacity} learners · {group.visibility}</small></div><button onClick={() => setEditing(editing === `group-${group.id}` ? '' : `group-${group.id}`)}>Edit</button></header>{editing === `group-${group.id}` && <form onSubmit={(event) => void updateGroup(event, group.id)}><input name="title" defaultValue={group.title} required /><input name="topic" defaultValue={group.topic} required /><select name="visibility" defaultValue={group.visibility}><option value="public">Public</option><option value="private">Private</option></select><input name="capacity" type="number" min="2" max="250" defaultValue={group.capacity} required /><textarea name="description" defaultValue={group.description} rows={3} required /><footer><button disabled={busy === 'update_group'}>{busy === 'update_group' ? 'Saving…' : 'Save changes'}</button><button type="button" className="admin-delete" onClick={() => confirmDelete('delete_group', group.id, group.title)}>Delete group</button></footer></form>}</article>) : <p className="space-admin-empty">No study groups created yet.</p>}</section><section><h3>Study rooms <small>{data.rooms.length}</small></h3>{data.rooms.length ? data.rooms.map((room) => <article key={room.id}><header><span>◌</span><div><strong>{room.title}</strong><small>{room.topic} · {room.posts} discussions</small></div><button onClick={() => setEditing(editing === `room-${room.id}` ? '' : `room-${room.id}`)}>Edit</button></header>{editing === `room-${room.id}` && <form onSubmit={(event) => void updateRoom(event, room.id)}><input name="title" defaultValue={room.title} required /><input name="topic" defaultValue={room.topic} required /><textarea name="description" defaultValue={room.description} rows={3} required /><footer><button disabled={busy === 'update_room'}>{busy === 'update_room' ? 'Saving…' : 'Save changes'}</button><button type="button" className="admin-delete" onClick={() => confirmDelete('delete_room', room.id, room.title)}>Delete room</button></footer></form>}</article>) : <p className="space-admin-empty">No study rooms created yet.</p>}</section><section><h3>Shared resources <small>{data.resources.length}</small></h3>{data.resources.length ? data.resources.map((resource) => <article key={resource.id}><header><span>▤</span><div><strong>{resource.title}</strong><small>{resource.subject} · {resource.resource_type} · {resource.status}</small></div><button className="admin-delete" onClick={() => confirmDelete('delete_resource', resource.id, resource.title)}>Delete</button></header></article>) : <p className="space-admin-empty">No shared resources yet.</p>}</section></div></section>}{tab === 'reports' && <section className="space-admin-reports"><header><div><span>MODERATION QUEUE</span><h2>Respond with <em>care.</em></h2></div><small>Reports are private. Reporter identities are not shown.</small></header>{data.reports.length ? <div>{data.reports.map((report) => <article key={report.id} className={report.status === 'open' ? '' : 'is-closed'}><header><span className={`report-status ${report.status}`}>{report.status === 'open' ? 'OPEN' : report.status.toUpperCase()}</span><small>{report.target_type.replace('_', ' ')} · {new Date(report.created_at).toLocaleDateString()}</small></header><h3>{report.target_label || 'Community content'}</h3><p><b>{report.reason}</b>{report.details && ` · ${report.details}`}</p>{report.status === 'open' && <footer><button onClick={() => void action('resolve_report', { id: report.id }, 'Report resolved and content kept.')}>Keep &amp; resolve</button><button className="admin-delete" onClick={() => { if (window.confirm('Remove the reported content? This cannot be undone.')) void action('remove_reported_content', { id: report.id }, 'Reported content removed.'); }}>Remove content</button></footer>}</article>)}</div> : <div className="space-admin-clear"><span>✓</span><strong>Your moderation queue is clear.</strong><p>When a learner reports content you own, it will appear here privately.</p></div>}</section>}{error && <p className="space-admin-error" role="alert">{error}</p>}</>}
  </section>;
}
