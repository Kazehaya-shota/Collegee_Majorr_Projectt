import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { parseCourseDraft } from '@/lib/course-draft';
import { parseCourseSources } from '@/lib/course-sources';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type SaveCourseRequest = {
  draft?: unknown;
  topic?: unknown;
  level?: unknown;
  timePerDay?: unknown;
  sources?: unknown;
};

function text(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to save this learning path.' }, { status: 401 });

  let body: SaveCourseRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Please send a valid course draft.' }, { status: 400 });
  }

  try {
    const draft = parseCourseDraft(body.draft);
    const sources = parseCourseSources(body.sources);
    const supabase = createSupabaseAdminClient();
    const { error: profileError } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
    if (profileError) throw profileError;

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({
        owner_id: userId,
        title: draft.title,
        summary: draft.summary,
        topic: text(body.topic, draft.title, 160),
        level: text(body.level, 'Some experience', 80),
        daily_time: text(body.timePerDay, '20 minutes a day', 80),
        estimated_minutes: draft.estimatedMinutes,
      })
      .select('id')
      .single();
    if (courseError || !course) throw courseError || new Error('Course could not be saved.');

    const { error: moduleError } = await supabase.from('course_modules').insert(
      draft.modules.map((module, index) => ({
        course_id: course.id,
        position: index + 1,
        title: module.title,
        description: module.description,
        estimated_minutes: module.estimatedMinutes,
      })),
    );
    if (moduleError) throw moduleError;

    if (sources.length) {
      const { error: sourceError } = await supabase.from('course_sources').insert(sources.map((source) => ({
        course_id: course.id,
        source_type: source.sourceType,
        label: source.label,
        url: source.url ?? null,
        source_text: source.sourceText ?? null,
      })));
      if (sourceError) throw sourceError;
    }

    return NextResponse.json({ courseId: course.id }, { status: 201 });
  } catch (error) {
    console.error('Course save failed', error);
    const message = error instanceof Error && error.message.startsWith('Supabase is not configured')
      ? 'Course saving is not configured yet. Add your Supabase keys first.'
      : 'We could not save this course right now. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
