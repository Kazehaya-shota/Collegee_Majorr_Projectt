import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { moderateCommunityMaterial } from '@/lib/ai/claude';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'community-resources';

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

async function ensureProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
  if (error) throw error;
  return supabase;
}

async function ownRecord(supabase: ReturnType<typeof createSupabaseAdminClient>, table: string, id: string, userId: string, ownerColumn = 'created_by') {
  const { data, error } = await supabase.from(table).select(`${ownerColumn}`).eq('id', id).maybeSingle();
  const record = data as Record<string, unknown> | null;
  if (error || !record || record[ownerColumn] !== userId) return false;
  return true;
}

async function moderationBlocked(kind: string, title: string, content: string) {
  try {
    const result = await moderateCommunityMaterial({ kind, title, text: content });
    return result.decision === 'block';
  } catch {
    return true;
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to open Space Admin.' }, { status: 401 });
  try {
    const supabase = await ensureProfile(userId);
    const [{ data: groups, error: groupsError }, { data: rooms, error: roomsError }, { data: resources, error: resourcesError }, { data: reports, error: reportsError }] = await Promise.all([
      supabase.from('community_groups').select('id, title, topic, description, visibility, capacity, created_at').eq('created_by', userId).order('created_at', { ascending: false }),
      supabase.from('community_rooms').select('id, title, topic, description, created_at').eq('created_by', userId).order('created_at', { ascending: false }),
      supabase.from('community_resources').select('id, title, subject, resource_type, object_path, status, created_at').eq('owner_id', userId).order('created_at', { ascending: false }),
      supabase.from('community_reports').select('id, target_type, target_id, target_label, reason, details, status, created_at').eq('assigned_to', userId).order('created_at', { ascending: false }).limit(60),
    ]);
    if (groupsError || roomsError || resourcesError || reportsError) throw groupsError || roomsError || resourcesError || reportsError;
    const groupIds = (groups ?? []).map((group) => group.id);
    const roomIds = (rooms ?? []).map((room) => room.id);
    const [{ data: members, error: membersError }, { data: posts, error: postsError }] = await Promise.all([
      groupIds.length ? supabase.from('community_group_members').select('group_id, status').in('group_id', groupIds) : Promise.resolve({ data: [], error: null }),
      roomIds.length ? supabase.from('community_posts').select('room_id').in('room_id', roomIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (membersError || postsError) throw membersError || postsError;
    const memberCount = new Map<string, number>();
    (members ?? []).filter((member) => member.status === 'active').forEach((member) => memberCount.set(member.group_id, (memberCount.get(member.group_id) ?? 0) + 1));
    const postCount = new Map<string, number>();
    (posts ?? []).forEach((post) => postCount.set(post.room_id, (postCount.get(post.room_id) ?? 0) + 1));
    return NextResponse.json({ groups: (groups ?? []).map((group) => ({ ...group, members: memberCount.get(group.id) ?? 0 })), rooms: (rooms ?? []).map((room) => ({ ...room, posts: postCount.get(room.id) ?? 0 })), resources: resources ?? [], reports: reports ?? [] });
  } catch (error) {
    console.error('Space Admin loading failed', error);
    return NextResponse.json({ error: 'Space Admin is not configured yet. Run the Community moderation SQL migration first.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to manage your Community Space.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Please send valid admin details.' }, { status: 400 }); }
  const action = text(body.action, 40);
  const id = text(body.id, 80);
  try {
    const supabase = await ensureProfile(userId);
    if (action === 'update_group') {
      const title = text(body.title, 80); const topic = text(body.topic, 80); const description = text(body.description, 300); const visibility = text(body.visibility, 10) === 'private' ? 'private' : 'public'; const capacity = Math.min(250, Math.max(2, Number(body.capacity) || 30));
      if (!await ownRecord(supabase, 'community_groups', id, userId) || title.length < 3 || topic.length < 2 || description.length < 10) return NextResponse.json({ error: 'Add valid group details.' }, { status: 400 });
      if (await moderationBlocked('study group', `${title} · ${topic}`, description)) return NextResponse.json({ error: 'These group details can’t be shared because they may not be appropriate for CourseMaster.', blocked: true }, { status: 422 });
      const { error } = await supabase.from('community_groups').update({ title, topic, description, visibility, capacity }).eq('id', id).eq('created_by', userId);
      if (error) throw error;
    } else if (action === 'delete_group') {
      if (!await ownRecord(supabase, 'community_groups', id, userId)) return NextResponse.json({ error: 'Only the group host can delete this group.' }, { status: 403 });
      const { error } = await supabase.from('community_groups').delete().eq('id', id).eq('created_by', userId);
      if (error) throw error;
    } else if (action === 'update_room') {
      const title = text(body.title, 80); const topic = text(body.topic, 80); const description = text(body.description, 300);
      if (!await ownRecord(supabase, 'community_rooms', id, userId) || title.length < 3 || topic.length < 2 || description.length < 10) return NextResponse.json({ error: 'Add valid room details.' }, { status: 400 });
      if (await moderationBlocked('study room', `${title} · ${topic}`, description)) return NextResponse.json({ error: 'These room details can’t be shared because they may not be appropriate for CourseMaster.', blocked: true }, { status: 422 });
      const { error } = await supabase.from('community_rooms').update({ title, topic, description }).eq('id', id).eq('created_by', userId);
      if (error) throw error;
    } else if (action === 'delete_room') {
      if (!await ownRecord(supabase, 'community_rooms', id, userId)) return NextResponse.json({ error: 'Only the room host can delete this room.' }, { status: 403 });
      const { error } = await supabase.from('community_rooms').delete().eq('id', id).eq('created_by', userId);
      if (error) throw error;
    } else if (action === 'delete_resource') {
      const { data: resource } = await supabase.from('community_resources').select('owner_id, object_path').eq('id', id).maybeSingle();
      if (!resource || resource.owner_id !== userId) return NextResponse.json({ error: 'Only the uploader can delete this resource.' }, { status: 403 });
      if (resource.object_path) await supabase.storage.from(BUCKET).remove([resource.object_path]);
      const { error } = await supabase.from('community_resources').delete().eq('id', id).eq('owner_id', userId);
      if (error) throw error;
    } else if (action === 'resolve_report' || action === 'remove_reported_content') {
      const { data: report, error: reportError } = await supabase.from('community_reports').select('id, target_type, target_id').eq('id', id).eq('assigned_to', userId).eq('status', 'open').maybeSingle();
      if (reportError || !report) return NextResponse.json({ error: 'That report is no longer available.' }, { status: 404 });
      if (action === 'remove_reported_content') {
        if (report.target_type === 'group') await supabase.from('community_groups').delete().eq('id', report.target_id).eq('created_by', userId);
        else if (report.target_type === 'room') await supabase.from('community_rooms').delete().eq('id', report.target_id).eq('created_by', userId);
        else if (report.target_type === 'post') await supabase.from('community_posts').delete().eq('id', report.target_id);
        else if (report.target_type === 'reply') await supabase.from('community_replies').delete().eq('id', report.target_id);
        else if (report.target_type === 'resource') {
          const { data: resource } = await supabase.from('community_resources').select('object_path').eq('id', report.target_id).eq('owner_id', userId).maybeSingle();
          if (resource?.object_path) await supabase.storage.from(BUCKET).remove([resource.object_path]);
          await supabase.from('community_resources').delete().eq('id', report.target_id).eq('owner_id', userId);
        } else await supabase.from('community_resource_comments').delete().eq('id', report.target_id);
      }
      const { error } = await supabase.from('community_reports').update({ status: action === 'remove_reported_content' ? 'removed' : 'resolved', resolved_at: new Date().toISOString() }).eq('id', report.id).eq('assigned_to', userId);
      if (error) throw error;
    } else return NextResponse.json({ error: 'That Space Admin action is not available.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Space Admin action failed', error);
    return NextResponse.json({ error: 'We could not update your Community Space.' }, { status: 502 });
  }
}
