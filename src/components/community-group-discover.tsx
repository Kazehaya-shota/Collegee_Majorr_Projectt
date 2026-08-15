'use client';

import { FormEvent, useMemo, useState } from 'react';

export type StudyGroup = {
  id: string;
  title: string;
  topic: string;
  description: string;
  visibility: 'public' | 'private';
  capacity: number;
  isMine: boolean;
  membership: 'active' | 'requested' | null;
  members: number;
  inviteCode: string | null;
  pendingRequestId: string | null;
  pendingRequests: number;
};

type Props = {
  groups: StudyGroup[];
  busy: string;
  action: (actionName: string, values: Record<string, unknown>) => Promise<unknown>;
  onNotice: (notice: string) => void;
};

export function CommunityGroupDiscover({ groups, busy, action, onNotice }: Props) {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const visibleGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? groups.filter((group) => `${group.title} ${group.topic} ${group.description}`.toLowerCase().includes(term)) : groups;
  }, [groups, query]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action('create_group', { title: form.get('title'), topic: form.get('topic'), description: form.get('description'), visibility: form.get('visibility'), capacity: form.get('capacity') });
    if (result) { setShowCreate(false); onNotice('Your study group is live. Share its invite code when you are ready.'); }
  }

  async function joinByInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await action('join_group_invite', { inviteCode });
    if (result) { setInviteCode(''); onNotice('Invite accepted — you are now in the study group.'); }
  }

  async function joinGroup(group: StudyGroup) {
    const result = await action('join_group', { groupId: group.id });
    if (result) onNotice(group.visibility === 'private' ? 'Your request is with the group host.' : `You joined ${group.title}.`);
  }

  function copyInvite(code: string) {
    void navigator.clipboard?.writeText(code);
    onNotice(`Group invite code ${code} copied.`);
  }

  return <section className="community-groups" aria-label="Discover study groups">
    <header className="community-section-head"><div><span>DISCOVER STUDY GROUPS</span><h2>Find people on the <em>same track.</em></h2></div><button onClick={() => setShowCreate((current) => !current)}>+ Start a group</button></header>
    <div className="community-group-tools"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by topic, subject, or goal" aria-label="Search study groups" /></label><form onSubmit={joinByInvite}><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="Have an invite code?" maxLength={10} aria-label="Study group invite code" /><button disabled={!inviteCode.trim() || busy === 'join_group_invite'}>{busy === 'join_group_invite' ? 'Joining…' : 'Join with code →'}</button></form></div>
    {showCreate && <form className="community-create-form group-form" onSubmit={createGroup}><input name="title" placeholder="Group name — e.g. Frontend Placement Circle" required maxLength={80} /><input name="topic" placeholder="Topic or goal — e.g. React interviews" required maxLength={80} /><select name="visibility" defaultValue="public" aria-label="Group privacy"><option value="public">Public — anyone can join</option><option value="private">Private — approve requests</option></select><input name="capacity" type="number" min="2" max="250" defaultValue="30" aria-label="Maximum members" /><textarea name="description" placeholder="Who is this group for and what will you work on together?" required minLength={10} maxLength={300} rows={3} /><button disabled={busy === 'create_group'}>{busy === 'create_group' ? 'Creating group…' : 'Create study group →'}</button></form>}
    <div className="community-group-grid">{visibleGroups.length ? visibleGroups.map((group) => <article key={group.id}><header><span className={group.visibility === 'private' ? 'is-private' : ''}>{group.visibility === 'private' ? '◈ PRIVATE' : '◌ OPEN GROUP'}</span>{group.isMine && <small>YOU HOST</small>}</header><h3>{group.title}</h3><p className="group-topic">{group.topic}</p><p>{group.description}</p><footer><small><b>◉</b> {group.members}/{group.capacity} learners</small>{group.isMine ? <div>{group.inviteCode && <button className="community-plain-button" onClick={() => copyInvite(group.inviteCode!)}>⌁ Invite</button>}{group.pendingRequestId && <button onClick={() => void action('approve_group_request', { groupId: group.id, requestId: group.pendingRequestId }).then((result) => { if (result) onNotice('One learner has been approved.'); })}>Approve {group.pendingRequests} request{group.pendingRequests === 1 ? '' : 's'} →</button>}</div> : group.membership === 'active' ? <button disabled>You&apos;re in ✓</button> : group.membership === 'requested' ? <button disabled>Request sent</button> : <button onClick={() => void joinGroup(group)} disabled={busy === 'join_group'}>{group.visibility === 'private' ? 'Request access →' : 'Join group →'}</button>}</footer></article>) : <div className="community-empty"><span>⌕</span><strong>No groups match that search.</strong><p>Try another topic, or start the group you wish existed.</p></div>}</div>
  </section>;
}
