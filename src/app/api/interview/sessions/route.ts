import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { parseInterviewFeedback, parseInterviewPlan, parseInterviewSetup, resourceShelf } from '@/lib/interview-prep';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { awardExperience } from '@/lib/gamification';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to save your interview report.' }, { status: 401 });
  try {
    const body = await request.json() as { setup?: unknown; plan?: unknown; feedback?: unknown; answers?: unknown };
    const setup = parseInterviewSetup(body.setup);
    const plan = parseInterviewPlan(body.plan);
    const feedback = parseInterviewFeedback(body.feedback);
    const answers = Array.isArray(body.answers) ? body.answers.slice(0, plan.questions.length).map((answer) => typeof answer === 'string' ? answer.slice(0, 4_000) : '') : [];
    const supabase = createSupabaseAdminClient();
    const { error: profileError } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
    if (profileError) throw profileError;
    const { data, error } = await supabase.from('interview_sessions').insert({
      user_id: userId,
      company: setup.company,
      role: setup.role,
      focus: setup.focus,
      experience: setup.experience,
      job_description: setup.jobDescription || null,
      questions: plan.questions,
      answers,
      feedback,
      score: feedback.score,
      resources: resourceShelf(setup),
    }).select('id').single();
    if (error || !data) throw error || new Error('Interview session could not be saved.');
    const reward = await awardExperience(supabase, userId, 45, 'interview');
    return NextResponse.json({ sessionId: data.id, earnedXp: reward.earnedXp });
  } catch (error) {
    console.error('Interview session save failed', error);
    const message = error instanceof Error && error.message.startsWith('Supabase is not configured')
      ? 'Your report is ready, but saving is not configured yet.'
      : 'Your report is ready, but we could not save it right now.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
