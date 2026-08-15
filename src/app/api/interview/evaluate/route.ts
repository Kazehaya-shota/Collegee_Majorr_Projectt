import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requestCourseDraft } from '@/lib/ai/claude';
import { createResilientInterviewFeedback, parseInterviewFeedback, parseInterviewPlan, parseInterviewSetup, type InterviewPlan, type InterviewSetup } from '@/lib/interview-prep';

export const runtime = 'nodejs';

function extractJson(output: string) {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : output;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to review this interview.' }, { status: 401 });
  let setup: InterviewSetup;
  let plan: InterviewPlan;
  let answers: string[];
  try {
    const body = await request.json() as { setup?: unknown; plan?: unknown; answers?: unknown };
    setup = parseInterviewSetup(body.setup);
    plan = parseInterviewPlan(body.plan);
    answers = Array.isArray(body.answers) ? body.answers.slice(0, plan.questions.length).map((answer) => typeof answer === 'string' ? answer.trim().slice(0, 1_100) : '') : [];
  } catch {
    return NextResponse.json({ error: 'We could not read this interview session. Please begin a new one.' }, { status: 400 });
  }
  if (answers.length !== plan.questions.length || answers.some((answer) => !answer)) return NextResponse.json({ error: 'Answer every question before requesting feedback.' }, { status: 400 });
  try {
    const transcript = plan.questions.map((question, index) => `Question ${index + 1} (${question.category}): ${question.prompt}\nCandidate answer: ${answers[index]}`).join('\n\n');
    const prompt = `You are an encouraging but precise early-career interview coach. Give feedback for a practice interview, not an official hiring decision.\nTarget company: ${setup.company}\nRole: ${setup.role}\nFocus: ${setup.focus}\n\nTranscript:\n${transcript}\n\nAssess the substance of the answers, not grammar alone. Acknowledge when an answer is too short or lacks evidence. Never claim any answer is an official company standard. Return ONLY valid JSON:\n{\n  "score":72,\n  "readiness":"short label",\n  "summary":"2 concise sentences",\n  "strengths":["specific strength"],\n  "growthAreas":[{"title":"short label","note":"specific actionable advice"}],\n  "nextSteps":["short next action"],\n  "categoryScores":[{"label":"Clarity","score":70},{"label":"Structure","score":68},{"label":"Role knowledge","score":74},{"label":"Impact","score":66}]\n}`;
    const response = await requestCourseDraft(prompt);
    const output = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    return NextResponse.json({ feedback: parseInterviewFeedback(JSON.parse(extractJson(output))) });
  } catch (error) {
    console.error('Interview evaluation failed', error);
    return NextResponse.json({ feedback: createResilientInterviewFeedback(setup, answers), reviewMode: 'resilient' });
  }
}
