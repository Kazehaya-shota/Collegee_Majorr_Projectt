import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { awardExperience } from '@/lib/gamification';
import { parseGeneratedLesson } from '@/lib/lesson-content';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to submit a quiz.' }, { status: 401 });
  const { moduleId } = await params;
  let answers: number[];
  try {
    const body = await request.json() as { answers?: unknown };
    if (!Array.isArray(body.answers) || body.answers.length < 3 || body.answers.length > 12 || body.answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) throw new Error('Invalid answers');
    answers = body.answers as number[];
  } catch {
    return NextResponse.json({ error: 'Please answer every quiz question.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: module, error: moduleError } = await supabase.from('course_modules').select('id, course_id, lesson_content, quiz').eq('id', moduleId).maybeSingle();
    if (moduleError) throw moduleError;
    if (!module?.lesson_content || !module.quiz) return NextResponse.json({ error: 'Generate the lesson before taking its quiz.' }, { status: 400 });
    const { data: course, error: courseError } = await supabase.from('courses').select('id').eq('id', module.course_id).eq('owner_id', userId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return NextResponse.json({ error: 'You cannot take this quiz.' }, { status: 403 });

    const quiz = parseGeneratedLesson({ lesson: module.lesson_content, quiz: module.quiz }).quiz;
    if (answers.length !== quiz.length) return NextResponse.json({ error: 'Please answer every quiz question.' }, { status: 400 });
    const correct = quiz.reduce((count, question, index) => count + Number(answers[index] === question.correctIndex), 0);
    const score = Math.round((correct / quiz.length) * 100);
    const passed = score >= 67;
    const { data: previousProgress, error: progressLookupError } = await supabase.from('module_progress').select('status, xp_awarded, quiz_xp_awarded').eq('user_id', userId).eq('module_id', moduleId).maybeSingle();
    if (progressLookupError) throw progressLookupError;
    const { error: progressError } = await supabase.from('module_progress').upsert({
      user_id: userId,
      module_id: moduleId,
      status: previousProgress?.status ?? 'not_started',
      xp_awarded: previousProgress?.xp_awarded ?? 0,
      quiz_score: score,
      quiz_completed_at: new Date().toISOString(),
      quiz_xp_awarded: previousProgress?.quiz_xp_awarded ?? 0,
    }, { onConflict: 'user_id,module_id' });
    if (progressError) throw progressError;

    const reward = passed && !previousProgress?.quiz_xp_awarded
      ? await awardExperience(supabase, userId, 25, 'quiz')
      : null;
    if (reward) {
      const { error: xpError } = await supabase.from('module_progress').update({ quiz_xp_awarded: reward.earnedXp }).eq('user_id', userId).eq('module_id', moduleId);
      if (xpError) throw xpError;
    }

    return NextResponse.json({ score, passed, earnedXp: reward?.earnedXp ?? 0, stats: reward?.stats, explanations: quiz.map((question, index) => ({ correct: answers[index] === question.correctIndex, explanation: question.explanation })) });
  } catch (error) {
    console.error('Quiz submission failed', error);
    return NextResponse.json({ error: 'We could not score this quiz right now. Please try again.' }, { status: 500 });
  }
}
