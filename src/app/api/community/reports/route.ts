import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type TargetType = 'group' | 'room' | 'post' | 'reply' | 'resource' | 'resource_comment';
const TARGET_TYPES = new Set<TargetType>(['group', 'room', 'post', 'reply', 'resource', 'resource_comment']);
const REASONS = new Set(['inappropriate', 'harassment', 'spam', 'unsafe', 'other']);

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

async function ensureProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
  if (error) throw error;
  return supabase;
}

async function resolveTarget(supabase: ReturnType<typeof createSupabaseAdminClient>, type: TargetType, id: string) {
  if (type === 'group') {
    const { data } = await supabase.from('community_groups').select('created_by, title').eq('id', id).maybeSingle();
    return data ? { ownerId: data.created_by, label: data.title } : null;
  }
  if (type === 'room') {
    const { data } = await supabase.from('community_rooms').select('created_by, title').eq('id', id).maybeSingle();
    return data ? { ownerId: data.created_by, label: data.title } : null;
  }
  if (type === 'resource') {
    const { data } = await supabase.from('community_resources').select('owner_id, title').eq('id', id).maybeSingle();
    return data ? { ownerId: data.owner_id, label: data.title } : null;
  }
  if (type === 'post') {
    const { data: post } = await supabase.from('community_posts').select('room_id, body').eq('id', id).maybeSingle();
    if (!post) return null;
    const { data: room } = await supabase.from('community_rooms').select('created_by, title').eq('id', post.room_id).maybeSingle();
    return room ? { ownerId: room.created_by, label: `${room.title}: ${post.body.slice(0, 80)}` } : null;
  }
  if (type === 'reply') {
    const { data: reply } = await supabase.from('community_replies').select('post_id, body').eq('id', id).maybeSingle();
    if (!reply) return null;
    const { data: post } = await supabase.from('community_posts').select('room_id').eq('id', reply.post_id).maybeSingle();
    if (!post) return null;
    const { data: room } = await supabase.from('community_rooms').select('created_by, title').eq('id', post.room_id).maybeSingle();
    return room ? { ownerId: room.created_by, label: `${room.title}: ${reply.body.slice(0, 80)}` } : null;
  }
  const { data: comment } = await supabase.from('community_resource_comments').select('resource_id, body').eq('id', id).maybeSingle();
  if (!comment) return null;
  const { data: resource } = await supabase.from('community_resources').select('owner_id, title').eq('id', comment.resource_id).maybeSingle();
  return resource ? { ownerId: resource.owner_id, label: `${resource.title}: ${comment.body.slice(0, 80)}` } : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to report Community content.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Please send valid report details.' }, { status: 400 }); }
  const targetType = text(body.targetType, 30) as TargetType;
  const targetId = text(body.targetId, 80);
  const reason = text(body.reason, 30);
  const details = text(body.details, 600);
  if (!TARGET_TYPES.has(targetType) || !targetId || !REASONS.has(reason)) return NextResponse.json({ error: 'Choose a valid report reason.' }, { status: 400 });
  try {
    const supabase = await ensureProfile(userId);
    const target = await resolveTarget(supabase, targetType, targetId);
    if (!target) return NextResponse.json({ error: 'That item is no longer available.' }, { status: 404 });
    if (target.ownerId === userId) return NextResponse.json({ error: 'You cannot report your own content.' }, { status: 400 });
    const { error } = await supabase.from('community_reports').upsert({ reporter_id: userId, assigned_to: target.ownerId, target_type: targetType, target_id: targetId, target_label: target.label, reason, details, status: 'open' }, { onConflict: 'reporter_id,target_type,target_id' });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Community report failed', error);
    return NextResponse.json({ error: 'We could not send that report. Make sure the Community moderation SQL migration has been run.' }, { status: 502 });
  }
}
