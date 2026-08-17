import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { moderateCommunityMaterial, requestCourseDraft } from '@/lib/ai/claude';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type StoredQuestion = { question: string; options: string[]; correctIndex: number; explanation: string };

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function publicQuestion(question: StoredQuestion) {
  return { question: question.question, options: question.options };
}

function parseQuestions(value: unknown): StoredQuestion[] {
  if (!Array.isArray(value) || value.length < 3) throw new Error('Challenge questions are incomplete.');
  return value.slice(0, 6).map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('Challenge question is invalid.');
    const entry = item as Record<string, unknown>;
    if (!Array.isArray(entry.options) || entry.options.length !== 4) throw new Error('Challenge options are invalid.');
    const correctIndex = Number(entry.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error('Challenge answer is invalid.');
    return { question: text(entry.question, 300) || `Question ${index + 1}`, options: entry.options.map((option, optionIndex) => text(option, 180) || `Option ${optionIndex + 1}`), correctIndex, explanation: text(entry.explanation, 400) || 'Review this topic before your next challenge.' };
  });
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : value).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Challenge generation was incomplete.');
  return candidate.slice(start, end + 1);
}

async function ensureProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
  if (error) throw error;
  return supabase;
}

function setupError() {
  return NextResponse.json({ error: 'Community storage is not configured yet. Run the Community SQL migration first.', setupRequired: true }, { status: 503 });
}

function communityBlock() {
  return NextResponse.json({ error: 'This content can’t be shared because it may not be appropriate for Zentrix.', blocked: true }, { status: 422 });
}

async function contentBlocked(kind: string, title: string, content: string) {
  try {
    const review = await moderateCommunityMaterial({ kind, title, text: content });
    return review.decision === 'block';
  } catch (error) {
    console.error('Community moderation failed', error);
    return true;
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to open Community.' }, { status: 401 });
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: rooms, error: roomsError }, { data: challenges, error: challengesError }, { data: events, error: eventsError }, { data: groups, error: groupsError }] = await Promise.all([
      supabase.from('community_rooms').select('id, title, topic, description, created_by, created_at').order('created_at', { ascending: false }).limit(12),
      supabase.from('community_challenges').select('id, created_by, title, topic, duration_minutes, invite_code, questions, created_at').order('created_at', { ascending: false }).limit(8),
      supabase.from('community_events').select('id, created_by, title, description, event_date, team_size, skills, created_at').order('event_date', { ascending: true }).limit(10),
      supabase.from('community_groups').select('id, title, topic, description, visibility, capacity, invite_code, created_by, created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    if (roomsError || challengesError || eventsError || groupsError) return setupError();
    const roomIds = (rooms ?? []).map((room) => room.id);
    const challengeIds = (challenges ?? []).map((challenge) => challenge.id);
    const eventIds = (events ?? []).map((event) => event.id);
    const groupIds = (groups ?? []).map((group) => group.id);
    const [{ data: posts, error: postsError }, { data: entries, error: entriesError }, { data: members, error: membersError }, { data: groupMembers, error: groupMembersError }] = await Promise.all([
      roomIds.length ? supabase.from('community_posts').select('id, room_id, author_id, body, upvotes, created_at').in('room_id', roomIds).order('created_at', { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      challengeIds.length ? supabase.from('community_challenge_entries').select('challenge_id, user_id, score, completed_at').in('challenge_id', challengeIds).order('score', { ascending: false, nullsFirst: false }) : Promise.resolve({ data: [], error: null }),
      eventIds.length ? supabase.from('community_event_members').select('event_id, user_id').in('event_id', eventIds) : Promise.resolve({ data: [], error: null }),
      groupIds.length ? supabase.from('community_group_members').select('id, group_id, user_id, role, status').in('group_id', groupIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (postsError || entriesError || membersError || groupMembersError) return setupError();
    const postIds = (posts ?? []).map((post) => post.id);
    const { data: replies, error: repliesError } = postIds.length ? await supabase.from('community_replies').select('id, post_id, author_id, body, created_at').in('post_id', postIds).order('created_at', { ascending: true }) : { data: [], error: null };
    if (repliesError) return setupError();

    const postsByRoom = new Map<string, typeof posts>();
    (posts ?? []).forEach((post) => postsByRoom.set(post.room_id, [...(postsByRoom.get(post.room_id) ?? []), post]));
    const repliesByPost = new Map<string, typeof replies>();
    (replies ?? []).forEach((reply) => repliesByPost.set(reply.post_id, [...(repliesByPost.get(reply.post_id) ?? []), reply]));
    const entriesByChallenge = new Map<string, typeof entries>();
    (entries ?? []).forEach((entry) => entriesByChallenge.set(entry.challenge_id, [...(entriesByChallenge.get(entry.challenge_id) ?? []), entry]));
    const membersByEvent = new Map<string, typeof members>();
    (members ?? []).forEach((member) => membersByEvent.set(member.event_id, [...(membersByEvent.get(member.event_id) ?? []), member]));
    const membersByGroup = new Map<string, typeof groupMembers>();
    (groupMembers ?? []).forEach((member) => membersByGroup.set(member.group_id, [...(membersByGroup.get(member.group_id) ?? []), member]));

    return NextResponse.json({
      rooms: (rooms ?? []).map((room) => ({ ...room, isMine: room.created_by === userId, posts: (postsByRoom.get(room.id) ?? []).map((post) => ({ ...post, isMine: post.author_id === userId, replies: (repliesByPost.get(post.id) ?? []).map((reply) => ({ ...reply, isMine: reply.author_id === userId })) })) })),
      challenges: (challenges ?? []).map((challenge) => {
        const challengeEntries = entriesByChallenge.get(challenge.id) ?? [];
        const ownEntry = challengeEntries.find((entry) => entry.user_id === userId);
        return { id: challenge.id, title: challenge.title, topic: challenge.topic, durationMinutes: challenge.duration_minutes, inviteCode: challenge.invite_code, createdAt: challenge.created_at, isMine: challenge.created_by === userId, questions: parseQuestions(challenge.questions).map(publicQuestion), joined: Boolean(ownEntry), completed: Boolean(ownEntry?.completed_at), score: ownEntry?.score ?? null, participants: challengeEntries.length, leaderboard: challengeEntries.slice(0, 5).filter((entry) => entry.completed_at).map((entry, index) => ({ rank: index + 1, label: entry.user_id === userId ? 'You' : 'Community learner', score: entry.score ?? 0 })) };
      }),
      events: (events ?? []).map((event) => { const eventMembers = membersByEvent.get(event.id) ?? []; return { ...event, isMine: event.created_by === userId, joined: eventMembers.some((member) => member.user_id === userId), members: eventMembers.length }; }),
      groups: (groups ?? []).map((group) => {
        const groupMembersForGroup = membersByGroup.get(group.id) ?? [];
        const ownMembership = groupMembersForGroup.find((member) => member.user_id === userId);
        const pending = groupMembersForGroup.filter((member) => member.status === 'requested');
        return { id: group.id, title: group.title, topic: group.topic, description: group.description, visibility: group.visibility, capacity: group.capacity, isMine: group.created_by === userId, membership: ownMembership?.status ?? null, members: groupMembersForGroup.filter((member) => member.status === 'active').length, inviteCode: group.created_by === userId ? group.invite_code : null, pendingRequestId: group.created_by === userId ? pending[0]?.id ?? null : null, pendingRequests: group.created_by === userId ? pending.length : 0 };
      }),
    });
  } catch (error) {
    console.error('Community loading failed', error);
    return setupError();
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to use Community.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Please send valid Community details.' }, { status: 400 }); }
  const action = text(body.action, 40);
  try {
    const supabase = await ensureProfile(userId);
    if (action === 'create_group') {
      const title = text(body.title, 80); const topic = text(body.topic, 80); const description = text(body.description, 300); const visibility = text(body.visibility, 10) === 'private' ? 'private' : 'public'; const capacity = Math.min(250, Math.max(2, Number(body.capacity) || 30));
      if (title.length < 3 || topic.length < 2 || description.length < 10) return NextResponse.json({ error: 'Add a group name, topic, and short description.' }, { status: 400 });
      if (await contentBlocked('study group', `${title} · ${topic}`, description)) return communityBlock();
      const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const { data: group, error: groupError } = await supabase.from('community_groups').insert({ title, topic, description, visibility, capacity, invite_code: inviteCode, created_by: userId }).select('id').single();
      if (groupError || !group) throw groupError ?? new Error('Group could not be created.');
      const { error } = await supabase.from('community_group_members').insert({ group_id: group.id, user_id: userId, role: 'owner', status: 'active' });
      if (error) throw error;
    } else if (action === 'join_group' || action === 'join_group_invite') {
      const inviteCode = text(body.inviteCode, 20).toUpperCase();
      const groupId = text(body.groupId, 80);
      const groupQuery = supabase.from('community_groups').select('id, visibility, capacity').limit(1);
      const { data: group, error: groupError } = action === 'join_group_invite'
        ? await groupQuery.eq('invite_code', inviteCode).maybeSingle()
        : await groupQuery.eq('id', groupId).maybeSingle();
      if (groupError || !group) return NextResponse.json({ error: 'That study group is no longer available.' }, { status: 404 });
      const { data: existing, error: existingError } = await supabase.from('community_group_members').select('id, status').eq('group_id', group.id).eq('user_id', userId).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.status === 'active') return NextResponse.json({ ok: true, status: 'active' });
      if (group.visibility === 'private' && action !== 'join_group_invite') {
        const { error } = await supabase.from('community_group_members').upsert({ group_id: group.id, user_id: userId, status: 'requested' }, { onConflict: 'group_id,user_id' });
        if (error) throw error;
        return NextResponse.json({ ok: true, status: 'requested' });
      }
      const { count, error: countError } = await supabase.from('community_group_members').select('id', { count: 'exact', head: true }).eq('group_id', group.id).eq('status', 'active');
      if (countError) throw countError;
      if ((count ?? 0) >= group.capacity) return NextResponse.json({ error: 'This study group is already full.' }, { status: 409 });
      const { error } = await supabase.from('community_group_members').upsert({ group_id: group.id, user_id: userId, status: 'active' }, { onConflict: 'group_id,user_id' });
      if (error) throw error;
    } else if (action === 'approve_group_request') {
      const groupId = text(body.groupId, 80); const requestId = text(body.requestId, 80);
      const { data: group, error: groupError } = await supabase.from('community_groups').select('created_by, capacity').eq('id', groupId).maybeSingle();
      if (groupError || !group || group.created_by !== userId) return NextResponse.json({ error: 'Only the group host can approve members.' }, { status: 403 });
      const { count, error: countError } = await supabase.from('community_group_members').select('id', { count: 'exact', head: true }).eq('group_id', groupId).eq('status', 'active');
      if (countError) throw countError;
      if ((count ?? 0) >= group.capacity) return NextResponse.json({ error: 'Your study group is already full.' }, { status: 409 });
      const { error } = await supabase.from('community_group_members').update({ status: 'active' }).eq('id', requestId).eq('group_id', groupId).eq('status', 'requested');
      if (error) throw error;
    } else if (action === 'create_room') {
      const title = text(body.title, 80); const topic = text(body.topic, 80); const description = text(body.description, 300);
      if (title.length < 3 || topic.length < 2 || description.length < 10) return NextResponse.json({ error: 'Add a room name, topic, and short description.' }, { status: 400 });
      if (await contentBlocked('study room', `${title} · ${topic}`, description)) return communityBlock();
      const { error } = await supabase.from('community_rooms').insert({ title, topic, description, created_by: userId });
      if (error) throw error;
    } else if (action === 'create_post') {
      const roomId = text(body.roomId, 80); const content = text(body.content, 1800);
      if (!roomId || content.length < 3) return NextResponse.json({ error: 'Write a question or useful discussion prompt.' }, { status: 400 });
      if (await contentBlocked('study room discussion', 'Study room post', content)) return communityBlock();
      const { error } = await supabase.from('community_posts').insert({ room_id: roomId, author_id: userId, body: content });
      if (error) throw error;
    } else if (action === 'reply') {
      const postId = text(body.postId, 80); const content = text(body.content, 1200);
      if (!postId || content.length < 2) return NextResponse.json({ error: 'Write a helpful reply first.' }, { status: 400 });
      if (await contentBlocked('study room reply', 'Study room reply', content)) return communityBlock();
      const { error } = await supabase.from('community_replies').insert({ post_id: postId, author_id: userId, body: content });
      if (error) throw error;
    } else if (action === 'create_challenge') {
      const title = text(body.title, 100); const topic = text(body.topic, 120); const durationMinutes = Math.min(60, Math.max(3, Number(body.durationMinutes) || 10));
      if (title.length < 3 || topic.length < 2) return NextResponse.json({ error: 'Add a challenge title and a topic.' }, { status: 400 });
      const prompt = `Create a fair, beginner-to-intermediate quiz challenge on "${topic}" for college learners. Return ONLY valid JSON: {"questions":[{"question":"string","options":["string","string","string","string"],"correctIndex":0,"explanation":"string"}]}. Create exactly 5 multiple-choice questions. Use four plausible options, one correct answer, and concise explanations. Do not include Markdown.`;
      const generated = await requestCourseDraft(prompt, 1800);
      const output = generated.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
      const parsed = JSON.parse(extractJson(output)) as { questions?: unknown };
      const questions = parseQuestions(parsed.questions);
      const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
      const { error } = await supabase.from('community_challenges').insert({ created_by: userId, title, topic, duration_minutes: durationMinutes, invite_code: inviteCode, questions });
      if (error) throw error;
    } else if (action === 'join_challenge') {
      const challengeId = text(body.challengeId, 80);
      const { error } = await supabase.from('community_challenge_entries').upsert({ challenge_id: challengeId, user_id: userId }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true });
      if (error) throw error;
    } else if (action === 'submit_challenge') {
      const challengeId = text(body.challengeId, 80); const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
      const { data: challenge, error: challengeError } = await supabase.from('community_challenges').select('questions').eq('id', challengeId).maybeSingle();
      if (challengeError || !challenge) return NextResponse.json({ error: 'This challenge is no longer available.' }, { status: 404 });
      const questions = parseQuestions(challenge.questions);
      if (answers.length !== questions.length || answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) return NextResponse.json({ error: 'Choose an answer for every question.' }, { status: 400 });
      const score = Math.round((answers.filter((answer, index) => answer === questions[index].correctIndex).length / questions.length) * 100);
      const { error } = await supabase.from('community_challenge_entries').upsert({ challenge_id: challengeId, user_id: userId, answers, score, completed_at: new Date().toISOString() }, { onConflict: 'challenge_id,user_id' });
      if (error) throw error;
      return NextResponse.json({ score, explanations: questions.map((question) => question.explanation) });
    } else if (action === 'create_event') {
      const title = text(body.title, 100); const description = text(body.description, 800); const eventDate = text(body.eventDate, 80); const teamSize = Math.min(12, Math.max(1, Number(body.teamSize) || 4)); const skills = text(body.skills, 300).split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 8);
      if (title.length < 3 || description.length < 10 || Number.isNaN(new Date(eventDate).getTime())) return NextResponse.json({ error: 'Add an event title, description, and valid date.' }, { status: 400 });
      if (await contentBlocked('community event', title, description)) return communityBlock();
      const { error } = await supabase.from('community_events').insert({ created_by: userId, title, description, event_date: new Date(eventDate).toISOString(), team_size: teamSize, skills });
      if (error) throw error;
    } else if (action === 'join_event') {
      const eventId = text(body.eventId, 80);
      const { error } = await supabase.from('community_event_members').upsert({ event_id: eventId, user_id: userId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true });
      if (error) throw error;
    } else return NextResponse.json({ error: 'That Community action is not available.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Community action failed', error);
    return NextResponse.json({ error: action === 'create_challenge' ? 'We could not build that quiz challenge right now. Please try again.' : 'We could not save that Community update. Make sure the Community SQL migration has been run.' }, { status: 502 });
  }
}
