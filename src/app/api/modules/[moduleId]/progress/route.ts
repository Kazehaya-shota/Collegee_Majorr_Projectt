import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { awardExperience } from '@/lib/gamification';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to update your progress.' }, { status: 401 });

  const { moduleId } = await params;
  let status: 'completed';
  try {
    const body = await request.json() as { status?: unknown };
    if (body.status !== 'completed') throw new Error('Invalid status');
    status = 'completed';
  } catch {
    return NextResponse.json({ error: 'Please send a valid progress status.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: module, error: moduleError } = await supabase.from('course_modules').select('id, course_id').eq('id', moduleId).maybeSingle();
    if (moduleError) throw moduleError;
    if (!module) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });

    const { data: course, error: courseError } = await supabase.from('courses').select('id, course_xp_awarded').eq('id', module.course_id).eq('owner_id', userId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return NextResponse.json({ error: 'You cannot update this course.' }, { status: 403 });

    const { data: previousProgress, error: previousProgressError } = await supabase.from('module_progress').select('status, xp_awarded').eq('user_id', userId).eq('module_id', moduleId).maybeSingle();
    if (previousProgressError) throw previousProgressError;
    const alreadyCompleted = previousProgress?.status === 'completed';
    const { error: progressError } = await supabase.from('module_progress').upsert({
      user_id: userId,
      module_id: moduleId,
      status,
      completed_at: new Date().toISOString(),
      xp_awarded: previousProgress?.xp_awarded ?? 0,
    }, { onConflict: 'user_id,module_id' });
    if (progressError) throw progressError;

    const lessonReward = !alreadyCompleted && !previousProgress?.xp_awarded
      ? await awardExperience(supabase, userId, 50, 'lesson')
      : null;
    if (lessonReward) {
      const { error: xpError } = await supabase.from('module_progress').update({ xp_awarded: lessonReward.earnedXp }).eq('user_id', userId).eq('module_id', moduleId);
      if (xpError) throw xpError;
    }

    let courseReward = null;
    if (!course.course_xp_awarded) {
      const { data: courseModules, error: courseModulesError } = await supabase.from('course_modules').select('id').eq('course_id', course.id);
      if (courseModulesError) throw courseModulesError;
      const { data: completeProgress, error: completeProgressError } = await supabase.from('module_progress').select('module_id').eq('user_id', userId).eq('status', 'completed').in('module_id', (courseModules ?? []).map((item) => item.id));
      if (completeProgressError) throw completeProgressError;
      if (courseModules?.length && completeProgress?.length === courseModules.length) {
        const { data: claimedCourse, error: claimError } = await supabase.from('courses').update({ course_xp_awarded: 100 }).eq('id', course.id).eq('course_xp_awarded', 0).select('id').maybeSingle();
        if (claimError) throw claimError;
        if (claimedCourse) courseReward = await awardExperience(supabase, userId, 100, 'course');
      }
    }

    return NextResponse.json({ status, earnedXp: (lessonReward?.earnedXp ?? 0) + (courseReward?.earnedXp ?? 0), stats: courseReward?.stats ?? lessonReward?.stats, courseComplete: Boolean(courseReward) });
  } catch (error) {
    console.error('Module progress update failed', error);
    return NextResponse.json({ error: 'We could not update your progress right now.' }, { status: 500 });
  }
}
