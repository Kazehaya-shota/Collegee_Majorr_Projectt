import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { moderateCommunityMaterial } from '@/lib/ai/claude';
import { readDocument } from '@/lib/document-ingestion';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BUCKET = 'community-resources';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp']);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function tags(value: unknown) {
  return text(value, 300).split(',').map((tag) => tag.trim().replace(/[^\p{L}\p{N}+#.& -]/gu, '')).filter(Boolean).slice(0, 8);
}

function fileExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

function resourceType(mimeType: string, originalName: string | null) {
  const extension = fileExtension(originalName ?? '');
  if (mimeType.startsWith('image/')) return 'Image';
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension)) return 'Document';
  if (['ppt', 'pptx'].includes(extension)) return 'Slides';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'Data';
  return 'Notes';
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-120) || 'resource';
}

function setupError() {
  return NextResponse.json({ error: 'Resource Exchange storage is not configured yet. Run the Resource Exchange SQL migration first.', setupRequired: true }, { status: 503 });
}

async function ensureProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
  if (error) throw error;
  return supabase;
}

function moderationBlock() {
  return NextResponse.json({ error: 'This resource can’t be shared because it may not be appropriate for Zentrix.', blocked: true }, { status: 422 });
}

async function reviewMaterial(kind: string, title: string, content: string) {
  try {
    return await moderateCommunityMaterial({ kind, title, text: content });
  } catch (error) {
    console.error('Resource moderation failed', error);
    return { decision: 'block' as const, reason: 'This content could not be safely reviewed.' };
  }
}

async function reviewStoredFile(supabase: ReturnType<typeof createSupabaseAdminClient>, path: string, originalName: string, mimeType: string) {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !blob) return { decision: 'block' as const, reason: 'This resource could not be safely reviewed.' };
  try {
    const file = new File([blob], originalName, { type: mimeType });
    const extracted = await readDocument(file);
    if (!extracted.trim()) return { decision: 'block' as const, reason: 'This resource could not be safely reviewed.' };
    return await reviewMaterial('shared learning resource', originalName, extracted);
  } catch {
    return { decision: 'block' as const, reason: 'This resource could not be safely reviewed.' };
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to open Resource Exchange.' }, { status: 401 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data: resources, error: resourcesError } = await supabase.from('community_resources').select('id, owner_id, title, description, subject, tags, resource_type, original_name, mime_type, file_size, object_path, external_url, created_at').eq('status', 'published').order('created_at', { ascending: false }).limit(48);
    if (resourcesError) return setupError();
    const resourceIds = (resources ?? []).map((resource) => resource.id);
    const [{ data: saves, error: savesError }, { data: reactions, error: reactionsError }, { data: comments, error: commentsError }] = await Promise.all([
      resourceIds.length ? supabase.from('community_resource_saves').select('resource_id, user_id').in('resource_id', resourceIds) : Promise.resolve({ data: [], error: null }),
      resourceIds.length ? supabase.from('community_resource_reactions').select('resource_id, user_id').in('resource_id', resourceIds) : Promise.resolve({ data: [], error: null }),
      resourceIds.length ? supabase.from('community_resource_comments').select('id, resource_id, author_id, body, created_at').in('resource_id', resourceIds).order('created_at', { ascending: true }).limit(180) : Promise.resolve({ data: [], error: null }),
    ]);
    if (savesError || reactionsError || commentsError) return setupError();
    const savesByResource = new Map<string, typeof saves>();
    (saves ?? []).forEach((save) => savesByResource.set(save.resource_id, [...(savesByResource.get(save.resource_id) ?? []), save]));
    const reactionsByResource = new Map<string, typeof reactions>();
    (reactions ?? []).forEach((reaction) => reactionsByResource.set(reaction.resource_id, [...(reactionsByResource.get(reaction.resource_id) ?? []), reaction]));
    const commentsByResource = new Map<string, typeof comments>();
    (comments ?? []).forEach((comment) => commentsByResource.set(comment.resource_id, [...(commentsByResource.get(comment.resource_id) ?? []), comment]));

    const sharedResources = await Promise.all((resources ?? []).map(async (resource) => {
      let href = resource.external_url;
      if (resource.resource_type === 'file' && resource.object_path) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(resource.object_path, 60 * 60);
        href = data?.signedUrl ?? null;
      }
      const resourceSaves = savesByResource.get(resource.id) ?? [];
      const resourceReactions = reactionsByResource.get(resource.id) ?? [];
      const resourceComments = commentsByResource.get(resource.id) ?? [];
      return { id: resource.id, title: resource.title, description: resource.description, subject: resource.subject, tags: resource.tags ?? [], type: resource.resource_type === 'link' ? 'Link' : resourceType(resource.mime_type ?? '', resource.original_name), originalName: resource.original_name, fileSize: resource.file_size, createdAt: resource.created_at, href, isMine: resource.owner_id === userId, saved: resourceSaves.some((save) => save.user_id === userId), saves: resourceSaves.length, helpful: resourceReactions.some((reaction) => reaction.user_id === userId), helpfuls: resourceReactions.length, comments: resourceComments.map((comment) => ({ id: comment.id, body: comment.body, isMine: comment.author_id === userId })) };
    }));
    return NextResponse.json({ resources: sharedResources });
  } catch (error) {
    console.error('Resource Exchange loading failed', error);
    return setupError();
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to use Resource Exchange.' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: 'Please send valid resource details.' }, { status: 400 }); }
  const action = text(body.action, 40);
  try {
    const supabase = await ensureProfile(userId);
    if (action === 'create_upload') {
      const title = text(body.title, 120); const description = text(body.description, 600); const subject = text(body.subject, 80); const originalName = text(body.originalName, 180); const sourceText = text(body.moderationText, 16000); const size = Number(body.size); const extension = fileExtension(originalName);
      if (title.length < 3 || subject.length < 2 || !ALLOWED_EXTENSIONS.has(extension) || !Number.isFinite(size) || size < 1 || size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Add a title, subject, and a supported file up to 50 MB.' }, { status: 400 });
      const firstReview = await reviewMaterial('shared learning resource', `${title} · ${subject}`, `${description}\n${sourceText}`);
      if (firstReview.decision === 'block') return moderationBlock();
      const contentType = MIME_BY_EXTENSION[extension];
      const objectPath = `${userId.replace(/[^a-zA-Z0-9_-]/g, '-')}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(originalName)}`;
      const { data: resource, error: resourceError } = await supabase.from('community_resources').insert({ owner_id: userId, title, description, subject, tags: tags(body.tags), resource_type: 'file', original_name: originalName, mime_type: contentType, file_size: size, object_path: objectPath, status: 'uploading' }).select('id').single();
      if (resourceError || !resource) throw resourceError ?? new Error('Resource could not be created.');
      const { data: upload, error: uploadError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(objectPath);
      if (uploadError || !upload) throw uploadError ?? new Error('Upload could not be prepared.');
      return NextResponse.json({ resourceId: resource.id, path: upload.path, token: upload.token, contentType });
    }
    if (action === 'publish_upload') {
      const resourceId = text(body.resourceId, 80);
      const { data: resource, error: resourceError } = await supabase.from('community_resources').select('owner_id, status, object_path, original_name, mime_type').eq('id', resourceId).maybeSingle();
      if (resourceError || !resource || resource.owner_id !== userId) return NextResponse.json({ error: 'This upload is not available.' }, { status: 404 });
      if (!resource.object_path || !resource.original_name || !resource.mime_type) return moderationBlock();
      const fullReview = await reviewStoredFile(supabase, resource.object_path, resource.original_name, resource.mime_type);
      if (fullReview.decision === 'block') {
        await supabase.storage.from(BUCKET).remove([resource.object_path]);
        await supabase.from('community_resources').delete().eq('id', resourceId).eq('owner_id', userId);
        return moderationBlock();
      }
      const { error } = await supabase.from('community_resources').update({ status: 'published' }).eq('id', resourceId).eq('owner_id', userId).eq('status', 'uploading');
      if (error) throw error;
    } else if (action === 'create_link') {
      const title = text(body.title, 120); const description = text(body.description, 600); const subject = text(body.subject, 80); const url = text(body.url, 1200);
      let validUrl = '';
      try { const parsed = new URL(url); if (parsed.protocol === 'http:' || parsed.protocol === 'https:') validUrl = parsed.toString(); } catch { /* Invalid URLs are handled below. */ }
      if (title.length < 3 || subject.length < 2 || !validUrl) return NextResponse.json({ error: 'Add a title, subject, and a valid public link.' }, { status: 400 });
      const linkReview = await reviewMaterial('shared learning link', `${title} · ${subject}`, `${description}\n${validUrl}`);
      if (linkReview.decision === 'block') return moderationBlock();
      const { error } = await supabase.from('community_resources').insert({ owner_id: userId, title, description, subject, tags: tags(body.tags), resource_type: 'link', external_url: validUrl, status: 'published' });
      if (error) throw error;
    } else if (action === 'toggle_save' || action === 'toggle_helpful') {
      const resourceId = text(body.resourceId, 80);
      const table = action === 'toggle_save' ? 'community_resource_saves' : 'community_resource_reactions';
      const { data: existing, error: existingError } = await supabase.from(table).select('id').eq('resource_id', resourceId).eq('user_id', userId).maybeSingle();
      if (existingError) throw existingError;
      const { error } = existing ? await supabase.from(table).delete().eq('id', existing.id) : await supabase.from(table).insert({ resource_id: resourceId, user_id: userId });
      if (error) throw error;
    } else if (action === 'comment_resource') {
      const resourceId = text(body.resourceId, 80); const content = text(body.content, 1200);
      if (!resourceId || content.length < 2) return NextResponse.json({ error: 'Write a useful comment first.' }, { status: 400 });
      const commentReview = await reviewMaterial('resource discussion comment', 'Resource Exchange comment', content);
      if (commentReview.decision === 'block') return NextResponse.json({ error: 'This comment can’t be shared because it may not be appropriate for Zentrix.', blocked: true }, { status: 422 });
      const { error } = await supabase.from('community_resource_comments').insert({ resource_id: resourceId, author_id: userId, body: content });
      if (error) throw error;
    } else return NextResponse.json({ error: 'That Resource Exchange action is not available.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Resource Exchange action failed', error);
    return NextResponse.json({ error: 'We could not save that resource update. Make sure the Resource Exchange SQL migration has been run.' }, { status: 502 });
  }
}
