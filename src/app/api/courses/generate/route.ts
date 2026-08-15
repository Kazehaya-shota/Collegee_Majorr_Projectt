import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requestCourseDraft } from '@/lib/ai/claude';
import { parseCourseDraft } from '@/lib/course-draft';
import { parseCourseSources } from '@/lib/course-sources';

export const runtime = 'nodejs';

type GenerateRequest = {
  topic?: unknown;
  level?: unknown;
  timePerDay?: unknown;
  sources?: unknown;
};

function asShortText(value: unknown, fallback: string, limit: number) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim().slice(0, limit);
  return text || fallback;
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1] : text;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 401) return 'Claude could not authenticate. Check the API key in .env.local, then restart the app.';
    if (error.status === 404) return 'The selected Claude model is not available. Set ANTHROPIC_MODEL=claude-sonnet-5 in .env.local, then restart the app.';
    if (error.status === 429) return 'Claude is rate-limited or has no available credits. Check your Anthropic Console billing and try again shortly.';
    if (error.status === 400) return 'Claude rejected this request. Please try a shorter, more specific learning topic.';
  }
  if (error instanceof SyntaxError) return 'Claude returned a draft we could not read. Please try again.';
  if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) return error.message;
  return 'We could not generate a course right now. Please try again.';
}

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Please send a valid request.' }, { status: 400 });
  }

  const topic = asShortText(body.topic, '', 160);
  if (!topic) return NextResponse.json({ error: 'Tell us what you would like to learn.' }, { status: 400 });

  const level = asShortText(body.level, 'Some experience', 80);
  const timePerDay = asShortText(body.timePerDay, '20 minutes a day', 80);
  const sources = parseCourseSources(body.sources);
  const sourceContext = sources.length
    ? sources.map((source, index) => `${index + 1}. ${source.label}${source.url ? ` (${source.url})` : ''}${source.sourceText ? `\nNotes: ${source.sourceText}` : ''}`).join('\n\n')
    : 'No sources were provided.';
  const sourceGuidance = sources.length
    ? 'This is a source-driven course. Treat the supplied excerpts and notes as the primary syllabus: infer the course focus from them, preserve their important concepts, and do not introduce unrelated modules unless they are essential for comprehension.'
    : 'No sources were provided, so use the stated topic as the primary syllabus.';
  const prompt = `Create a personalized course roadmap for this learner.\n\nTopic: ${topic}\nCurrent level: ${level}\nAvailable time: ${timePerDay}\n\nUser-provided source context:\n${sourceContext}\n\n${sourceGuidance}\n\nThe course must be practical, have 4 to 7 modules, progress from foundations to application, and give each module an achievable time estimate. Do not claim to have verified a source or accessed information outside the source context provided here.\n\nReturn ONLY valid JSON in this exact shape:\n{\n  "title": "string",\n  "summary": "string, maximum 180 characters",\n  "estimatedMinutes": 180,\n  "modules": [\n    { "title": "string", "description": "string, maximum 110 characters", "estimatedMinutes": 25 }\n  ]\n}`;

  try {
    const response = await requestCourseDraft(prompt);
    const output = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
    const draft = parseCourseDraft(JSON.parse(extractJson(output)));
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Course generation failed', error);
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 502 });
  }
}
