import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';
import { requestCourseDraft } from '@/lib/ai/claude';
import { parseInterviewPlan, parseInterviewSetup } from '@/lib/interview-prep';

export const runtime = 'nodejs';

function extractJson(output: string) {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : output;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Sign in to start an interview mock.' }, { status: 401 });
    const setup = parseInterviewSetup(await request.json());
    const brief = setup.jobDescription ? `\nJob description / user notes:\n${setup.jobDescription}` : '';
    const prompt = `Design a realistic, text-based interview loop for a student or early-career candidate.\nCompany target: ${setup.company}\nRole: ${setup.role}\nCandidate stage: ${setup.experience}\nPriority: ${setup.focus}${brief}\n\nCreate EXACTLY 12 interviewer questions for a 30–40 minute practice session. The conversation should feel human and professionally paced, not like an AI questionnaire: begin with a warm introduction, deepen naturally through role knowledge and problem-solving, ask follow-ups that build on a candidate's likely examples without pretending you have heard an answer, include 3 to 4 behavioural questions, and finish with role/company fit plus one thoughtful question the candidate could ask. If the focus is Full interview loop, use the complete mix. If it is a specialist focus, keep most questions in that area but still include a natural opening and closing. Each question must be answerable without private company information, match the candidate stage, and never be described as an official past question. Do not invent company-specific process details. Keep each prompt under 80 words and each cue under 20 words.\n\nReturn ONLY valid JSON:\n{\n  "title":"string",\n  "companyNote":"string, 1 concise sentence",\n  "estimatedMinutes":35,\n  "questions":[{"category":"Introduction|Technical|Problem solving|Behavioural|Role fit|Follow-up","prompt":"string","cue":"string"}]\n}`;
    const response = await requestCourseDraft(prompt);
    const output = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    return NextResponse.json({ plan: parseInterviewPlan(JSON.parse(extractJson(output))) });
  } catch (error) {
    console.error('Interview mock generation failed', error);
    const message = error instanceof Anthropic.APIError && error.status === 429
      ? 'The interview coach is busy right now. Please try again in a moment.'
      : 'We could not prepare this mock interview right now. Please try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
