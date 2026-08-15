'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ProgressLoader } from '@/components/progress-loader';
import { CommunityGroupDiscover, type StudyGroup } from '@/components/community-group-discover';

type Reply = { id: string; body: string; isMine: boolean };
type Post = { id: string; body: string; upvotes: number; isMine: boolean; replies: Reply[] };
type Room = { id: string; title: string; topic: string; description: string; isMine: boolean; posts: Post[] };
type Challenge = { id: string; title: string; topic: string; durationMinutes: number; inviteCode: string; questions: Array<{ question: string; options: string[] }>; joined: boolean; completed: boolean; score: number | null; participants: number; leaderboard: Array<{ rank: number; label: string; score: number }> };
type Event = { id: string; title: string; description: string; event_date: string; team_size: number; skills: string[]; joined: boolean; members: number; isMine: boolean };
type CommunityData = { rooms: Room[]; challenges: Challenge[]; events: Event[]; groups: StudyGroup[] };
type Tab = 'rooms' | 'challenges' | 'events';

const emptyData: CommunityData = { rooms: [], challenges: [], events: [], groups: [] };

export function CommunityWorkspace({ initialTab = 'rooms', standalone = false }: { initialTab?: Tab; standalone?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<CommunityData>(emptyData);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [challengeAnswers, setChallengeAnswers] = useState<number[]>([]);
  const [challengeResult, setChallengeResult] = useState<{ score: number; explanations: string[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/community');
      const payload = await response.json() as CommunityData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'We could not open Community.');
      setData({ rooms: payload.rooms ?? [], challenges: payload.challenges ?? [], events: payload.events ?? [], groups: payload.groups ?? [] });
      setSelectedRoomId((current) => current || payload.rooms?.[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not open Community.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const selectedRoom = useMemo(() => data.rooms.find((room) => room.id === selectedRoomId) ?? data.rooms[0] ?? null, [data.rooms, selectedRoomId]);

  async function action(actionName: string, values: Record<string, unknown>) {
    setBusy(actionName); setError(''); setNotice('');
    try {
      const response = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, ...values }) });
      const payload = await response.json() as { error?: string; score?: number; explanations?: string[] };
      if (!response.ok) throw new Error(payload.error || 'That Community update could not be saved.');
      await load();
      return payload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'That Community update could not be saved.');
      return null;
    } finally { setBusy(''); }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action('create_room', { title: form.get('title'), topic: form.get('topic'), description: form.get('description') });
    if (result) { setShowCreate(false); setNotice('Your study room is live. Start the first discussion.'); }
  }

  async function createChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action('create_challenge', { title: form.get('title'), topic: form.get('topic'), durationMinutes: form.get('duration') });
    if (result) { setShowCreate(false); setNotice('Your invite-ready quiz challenge is live.'); }
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action('create_event', { title: form.get('title'), description: form.get('description'), eventDate: form.get('eventDate'), teamSize: form.get('teamSize'), skills: form.get('skills') });
    if (result) { setShowCreate(false); setNotice('Your event is now open for the community to join.'); }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoom) return;
    const result = await action('create_post', { roomId: selectedRoom.id, content: postDraft });
    if (result) setPostDraft('');
  }

  async function submitReply(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const result = await action('reply', { postId, content: replyDrafts[postId] });
    if (result) setReplyDrafts((current) => ({ ...current, [postId]: '' }));
  }

  async function beginChallenge(challenge: Challenge) {
    if (!challenge.joined) {
      const result = await action('join_challenge', { challengeId: challenge.id });
      if (!result) return;
    }
    setActiveChallenge(challenge); setChallengeAnswers([]); setChallengeResult(null);
  }

  async function submitChallenge() {
    if (!activeChallenge) return;
    const result = await action('submit_challenge', { challengeId: activeChallenge.id, answers: challengeAnswers });
    if (result?.score !== undefined && result.explanations) setChallengeResult({ score: result.score, explanations: result.explanations });
  }

  function copyInvite(code: string) {
    void navigator.clipboard?.writeText(`${window.location.origin}/dashboard/community?challenge=${code}`);
    setNotice(`Invite link copied — code ${code}.`);
  }

  return <section className="community-workspace">
    <header className="community-hero"><div><p className="eyebrow dark"><span>COURSEMASTER COMMUNITY</span> LEARN BETTER TOGETHER</p><h1>Find your <em>learning people.</em></h1><p>Ask, challenge, build, and show up for what you&apos;re learning—with learners who are doing the same.</p></div><aside><span>◌</span><strong>Built for momentum.</strong><p>Every room, challenge, and event is a small reason to keep going.</p></aside></header>
    {!standalone && <nav className="community-tabs" aria-label="Community sections"><button className={tab === 'rooms' ? 'is-active' : ''} onClick={() => { setTab('rooms'); setShowCreate(false); }}><span>◌</span>Study Rooms</button><button className={tab === 'challenges' ? 'is-active' : ''} onClick={() => { setTab('challenges'); setShowCreate(false); }}><span>⚑</span>Challenge Together</button><button className={tab === 'events' ? 'is-active' : ''} onClick={() => { setTab('events'); setShowCreate(false); }}><span>◇</span>Events &amp; Hackathons</button></nav>}
    {loading ? <ProgressLoader title="Opening the Community" detail="Gathering rooms, challenges, and events around you." /> : <>
      {notice && <p className="community-notice">✦ {notice}</p>}
      {tab === 'rooms' && <CommunityGroupDiscover groups={data.groups} busy={busy} action={action} onNotice={setNotice} />}
      {tab === 'rooms' && <section className="community-rooms" id="rooms"><header className="community-section-head"><div><span>STUDY ROOMS</span><h2>Ask it. Explain it. <em>Get unstuck.</em></h2></div><button onClick={() => setShowCreate((current) => !current)}>+ Create a room</button></header>{showCreate && <form className="community-create-form" onSubmit={createRoom}><input name="title" placeholder="Room name — e.g. DBMS Semester Prep" required maxLength={80} /><input name="topic" placeholder="Topic or course" required maxLength={80} /><textarea name="description" placeholder="What can learners use this room for?" required minLength={10} maxLength={300} rows={3} /><button disabled={busy === 'create_room'}>{busy === 'create_room' ? 'Creating room…' : 'Create study room →'}</button></form>}<div className="community-room-grid"><aside className="room-rail">{data.rooms.length ? data.rooms.map((room) => <button key={room.id} className={selectedRoom?.id === room.id ? 'is-selected' : ''} onClick={() => setSelectedRoomId(room.id)}><span>{room.topic.slice(0, 1).toUpperCase()}</span><div><strong>{room.title}</strong><small>{room.posts.length} discussion{room.posts.length === 1 ? '' : 's'}</small></div></button>) : <div className="community-empty"><span>◌</span><strong>No rooms yet.</strong><p>Create the first focused place for your class or topic.</p></div>}</aside><div className="room-feed">{selectedRoom ? <><header><div><span>{selectedRoom.topic}</span><h3>{selectedRoom.title}</h3><p>{selectedRoom.description}</p></div><small>{selectedRoom.isMine ? 'Your room' : 'Open room'}</small></header><form className="community-post-form" onSubmit={submitPost}><textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} placeholder={`Ask ${selectedRoom.title} a doubt or start a useful discussion…`} maxLength={1800} rows={3} /><button disabled={busy === 'create_post' || !postDraft.trim()}>{busy === 'create_post' ? 'Posting…' : 'Post to room →'}</button></form><div className="community-posts">{selectedRoom.posts.length ? selectedRoom.posts.map((post) => <article key={post.id}><header><span>{post.isMine ? 'You' : 'Learner'}</span><small>{post.replies.length} reply{post.replies.length === 1 ? '' : 'ies'}</small></header><p>{post.body}</p>{post.replies.length > 0 && <div className="community-replies">{post.replies.map((reply) => <p key={reply.id}><b>{reply.isMine ? 'You' : 'Learner'}</b>{reply.body}</p>)}</div>}<form onSubmit={(event) => void submitReply(event, post.id)}><input value={replyDrafts[post.id] ?? ''} onChange={(event) => setReplyDrafts((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="Add a helpful reply…" maxLength={1200} /><button disabled={busy === 'reply'}>Reply</button></form></article>) : <div className="community-feed-empty"><span>✦</span><strong>Start the first useful thread.</strong><p>A good question can save someone else an hour.</p></div>}</div></> : <div className="community-feed-empty"><span>◌</span><strong>Choose a room to begin.</strong></div>}</div></div></section>}
      {tab === 'challenges' && <section className="community-challenges" id="challenges"><header className="community-section-head"><div><span>CHALLENGE TOGETHER</span><h2>Make revision a <em>team sport.</em></h2></div><button onClick={() => setShowCreate((current) => !current)}>+ Create a quiz challenge</button></header>{showCreate && <form className="community-create-form challenge-form" onSubmit={createChallenge}><input name="title" placeholder="Challenge title — e.g. Networking Night Sprint" required maxLength={100} /><input name="topic" placeholder="Quiz topic — e.g. OSI model" required maxLength={120} /><select name="duration" defaultValue="10"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select><button disabled={busy === 'create_challenge'}>{busy === 'create_challenge' ? 'Building your quiz…' : 'Create challenge →'}</button></form>}{busy === 'create_challenge' && <ProgressLoader compact title="Building your shared quiz" detail="Writing fair questions and setting up the invite." />}{activeChallenge ? <section className="community-quiz-player"><header><button onClick={() => setActiveChallenge(null)}>← Back to challenges</button><span>{activeChallenge.topic} · {activeChallenge.durationMinutes} MIN</span><h3>{activeChallenge.title}</h3></header>{activeChallenge.questions.map((question, questionIndex) => <fieldset key={question.question} disabled={Boolean(challengeResult)}><legend>{questionIndex + 1}. {question.question}</legend>{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`challenge-${questionIndex}`} checked={challengeAnswers[questionIndex] === optionIndex} onChange={() => setChallengeAnswers((current) => { const next = [...current]; next[questionIndex] = optionIndex; return next; })} />{option}</label>)}{challengeResult && <p className={challengeAnswers[questionIndex] === undefined ? 'incorrect-answer' : 'correct-answer'}>{challengeResult.explanations[questionIndex]}</p>}</fieldset>)}{challengeResult ? <div className="community-score-result"><span>CHALLENGE COMPLETE</span><strong>{challengeResult.score}%</strong><p>{challengeResult.score >= 70 ? 'Strong work — your score is on the community board.' : 'Nice attempt. Read the explanations, then challenge yourself again.'}</p><button onClick={() => setActiveChallenge(null)}>Back to Community →</button></div> : <button className="community-submit-challenge" onClick={() => void submitChallenge()} disabled={busy === 'submit_challenge' || challengeAnswers.length !== activeChallenge.questions.length}>{busy === 'submit_challenge' ? 'Scoring your run…' : 'Finish challenge →'}</button>}</section> : <div className="community-challenge-grid">{data.challenges.length ? data.challenges.map((challenge) => <article key={challenge.id}><header><span>QUIZ CHALLENGE</span><button onClick={() => copyInvite(challenge.inviteCode)} title="Copy invite link">⌁ Invite</button></header><h3>{challenge.title}</h3><p>{challenge.topic}</p><div className="challenge-meta"><span>{challenge.questions.length} questions</span><span>{challenge.durationMinutes} min</span><span>{challenge.participants} joined</span></div>{challenge.leaderboard.length > 0 && <ol>{challenge.leaderboard.slice(0, 3).map((entry) => <li key={`${entry.rank}-${entry.label}`}><b>{entry.rank}</b><span>{entry.label}</span><strong>{entry.score}%</strong></li>)}</ol>}<button onClick={() => void beginChallenge(challenge)} disabled={busy === 'join_challenge'}>{challenge.completed ? `Your score: ${challenge.score}%` : challenge.joined ? 'Continue my challenge →' : 'Join & start challenge →'}</button></article>) : <div className="community-empty"><span>⚑</span><strong>No challenge has started yet.</strong><p>Create a short quiz and send its invite link to your friends.</p></div>}</div>}</section>}
      {tab === 'events' && <section className="community-events" id="events"><header className="community-section-head"><div><span>EVENTS &amp; HACKATHONS</span><h2>Find the next thing to <em>build.</em></h2></div><button onClick={() => setShowCreate((current) => !current)}>+ Host an event</button></header>{showCreate && <form className="community-create-form event-form" onSubmit={createEvent}><input name="title" placeholder="Event or hackathon title" required maxLength={100} /><textarea name="description" placeholder="What will learners build, practise, or prepare for?" required minLength={10} maxLength={800} rows={3} /><input name="eventDate" type="datetime-local" required /><input name="teamSize" type="number" min="1" max="12" defaultValue="4" /><input name="skills" placeholder="Skills — e.g. React, UI/UX, Python" maxLength={300} /><button disabled={busy === 'create_event'}>{busy === 'create_event' ? 'Publishing event…' : 'Open event →'}</button></form>}<div className="community-event-grid">{data.events.length ? data.events.map((event) => <article key={event.id}><div className="event-date"><span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(event.event_date))}</span><strong>{new Date(event.event_date).getDate()}</strong></div><div><p>{event.isMine ? 'YOU ARE HOSTING' : 'COMMUNITY EVENT'}</p><h3>{event.title}</h3><span>{new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(event.event_date))}</span><p className="event-description">{event.description}</p><div className="event-skills">{event.skills.map((skill) => <i key={skill}>{skill}</i>)}</div><footer><small>{event.members} going · teams of {event.team_size}</small><button onClick={() => void action('join_event', { eventId: event.id })} disabled={event.joined || busy === 'join_event'}>{event.joined ? 'You’re going ✓' : 'Join event →'}</button></footer></div></article>) : <div className="community-empty"><span>◇</span><strong>No events are live yet.</strong><p>Host your class hackathon, study sprint, or portfolio build night.</p></div>}</div></section>}
      {error && <p className="community-error" role="alert">{error}</p>}
    </>}
  </section>;
}
