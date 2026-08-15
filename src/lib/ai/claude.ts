import Anthropic from '@anthropic-ai/sdk';

const defaultModel = 'claude-sonnet-5';

function getApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is missing. Add it to your local .env.local file.');
  }
  return apiKey;
}

export function createClaudeClient() {
  return new Anthropic({ apiKey: getApiKey() });
}

export async function requestCourseDraft(prompt: string, maxTokens = 6_000) {
  const client = createClaudeClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || defaultModel,
    max_tokens: maxTokens,
    system: 'You are CourseMaster, an expert instructional designer. Create structured, practical learning plans. Do not invent sources or claims.',
    messages: [{ role: 'user', content: prompt }],
  });

  return response;
}
