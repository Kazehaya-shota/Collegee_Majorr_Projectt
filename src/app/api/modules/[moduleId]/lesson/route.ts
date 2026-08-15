import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { requestCourseDraft } from '@/lib/ai/claude';
import { extractJson, parseGeneratedLesson, toPublicLesson, type GeneratedLesson } from '@/lib/lesson-content';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type LessonContext = {
  course: { title: string; topic: string; level: string | null; daily_time: string | null };
  module: { title: string; description: string; estimated_minutes: number };
};

function errorMessage(error: unknown) {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Claude could not authenticate. Check the API key in .env.local, then restart the app.';
    if (error.status === 404) return 'The selected Claude model is not available. Update ANTHROPIC_MODEL in .env.local, then restart the app.';
    if (error.status === 429) return 'Claude is rate-limited or has no available credits. Check your Anthropic billing and try again shortly.';
    if (error.status === 400) return 'Claude rejected this lesson request. Please try again.';
    if (error.status === 529 || error.status >= 500) return 'Claude is temporarily busy. Please try again in a moment.';
  }
  if (error instanceof SyntaxError || error instanceof Error && error.message.startsWith('Claude returned')) return 'The lesson could not be completed just now. Please try again.';
  if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) return error.message;
  return 'We could not create this lesson right now. Please try again.';
}

function isLessonShapeError(error: unknown) {
  return error instanceof SyntaxError || error instanceof Error && error.message.startsWith('Claude returned');
}

function lessonPrompt({ course, module }: LessonContext, recovery = false) {
  const recoveryInstruction = recovery
    ? 'Your previous answer was incomplete. This time prioritize a fully complete JSON response: use 4 focused sections of 120–170 words and exactly 5 MCQs. Do not shorten the JSON structure or stop mid-answer.'
    : 'Write for genuine comprehension, not a short summary. Give clear explanations, a concrete example or scenario in each section, and one common mistake or nuance when useful. The learner should be able to study from this content without needing another explanation.';
  return `Create a detailed, practical lesson for one module in an AI-generated learning path.\n\nCourse: ${course.title}\nTopic: ${course.topic}\nLearner level: ${course.level ?? 'Some experience'}\nTime available: ${course.daily_time ?? '20 minutes a day'}\nModule: ${module.title}\nModule goal: ${module.description}\nLesson duration: about ${module.estimated_minutes} minutes\n\n${recoveryInstruction} Do not invent citations or sources.\n\nReturn ONLY valid JSON in this exact shape, with no Markdown fences or commentary before or after it:\n{
  "lesson": {
    "introduction": "string",
    "sections": [{ "heading": "string", "content": "string" }],
    "keyTakeaways": ["string"],
    "practicePrompt": "string"
  },
  "quiz": [
    { "question": "string", "options": ["string", "string", "string", "string"], "correctIndex": 0, "explanation": "string" }
  ]
}\n\nUse 4 or 5 sections. For the regular lesson, each section should be 160–220 words. Use 3 to 5 takeaways. Create 5 to 7 MCQs, with more questions for important or easily confused ideas. Keep explanations concise so the full JSON response is complete.`;
}

async function requestLesson(context: LessonContext, recovery = false): Promise<GeneratedLesson> {
  const response = await requestCourseDraft(lessonPrompt(context, recovery), recovery ? 5_000 : 7_500);
  const output = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
  return parseGeneratedLesson(JSON.parse(extractJson(output)));
}

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to generate a lesson.' }, { status: 401 });
  const { moduleId } = await params;
  let refresh = false;
  try {
    const body = await request.json() as { refresh?: unknown };
    refresh = body.refresh === true;
  } catch {
    // An empty request is valid when opening an already-created lesson.
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: module, error: moduleError } = await supabase.from('course_modules').select('id, course_id, title, description, estimated_minutes, lesson_content, quiz').eq('id', moduleId).maybeSingle();
    if (moduleError) throw moduleError;
    if (!module) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    const { data: course, error: courseError } = await supabase.from('courses').select('id, owner_id, title, topic, level, daily_time').eq('id', module.course_id).eq('owner_id', userId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return NextResponse.json({ error: 'You cannot open this course.' }, { status: 403 });

    if (!refresh && module.lesson_content && module.quiz) {
      try {
        return NextResponse.json(toPublicLesson(parseGeneratedLesson({ lesson: module.lesson_content, quiz: module.quiz })));
      } catch (cachedLessonError) {
        console.warn('Stored lesson was incomplete; regenerating it.', cachedLessonError);
      }
    }

    const context: LessonContext = { course, module };
    let generated: GeneratedLesson;
    try {
      generated = await requestLesson(context);
    } catch (initialError) {
      if (!isLessonShapeError(initialError)) throw initialError;
      console.warn('Lesson response was incomplete; requesting a recovery version.', initialError);
      generated = await requestLesson(context, true);
    }

    const { error: updateError } = await supabase.from('course_modules').update({ lesson_content: generated.lesson, quiz: generated.quiz, lesson_generated_at: new Date().toISOString() }).eq('id', moduleId);
    if (updateError) throw updateError;
    return NextResponse.json(toPublicLesson(generated));
  } catch (error) {
    console.error('Lesson generation failed', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 });
  }
}
