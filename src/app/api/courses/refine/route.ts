import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { requestCourseDraft } from '@/lib/ai/claude';
import { parseCourseDraft } from '@/lib/course-draft';

export const runtime = 'nodejs';

type RefineRequest = { draft?: unknown; instruction?: unknown };

function shortText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 400) : '';
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : text;
}

function safeMessage(error: unknown) {
  if (error instanceof Anthropic.APIError && error.status === 429) return 'Your learning coach is taking a short break. Please try again in a moment.';
  if (error instanceof Anthropic.APIError && error.status === 401) return 'The learning coach needs its API key checked before it can help.';
  return 'Your learning coach could not update the path right now. Please try again.';
}

export async function POST(request: Request) {
  let body: RefineRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Please send a valid course update.' }, { status: 400 });
  }

  try {
    const draft = parseCourseDraft(body.draft);
    const instruction = shortText(body.instruction);
    if (!instruction) return NextResponse.json({ error: 'Tell your learning coach what to change.' }, { status: 400 });

    const prompt = `You are a helpful learning coach. Update the learner's course outline based only on their request. Keep it practical, coherent, and appropriately scoped. Return only the updated course JSON.\n\nCurrent course:\n${JSON.stringify(draft)}\n\nLearner request:\n${instruction}\n\nReturn ONLY valid JSON in this exact shape:\n{\n  "title": "string",\n  "summary": "string, maximum 180 characters",\n  "estimatedMinutes": 180,\n  "modules": [\n    { "title": "string", "description": "string, maximum 110 characters", "estimatedMinutes": 25 }\n  ]\n}\n\nKeep 4 to 7 modules. Do not mention this conversation or say that you updated the plan.`;
    const response = await requestCourseDraft(prompt);
    const output = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    return NextResponse.json({ draft: parseCourseDraft(JSON.parse(extractJson(output))) });
  } catch (error) {
    console.error('Course refinement failed', error);
    return NextResponse.json({ error: safeMessage(error) }, { status: 502 });
  }
}
