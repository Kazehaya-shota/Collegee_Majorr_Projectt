export type IngestionQuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type IngestionSummary = {
  title: string;
  overview: string;
  concepts: Array<{ heading: string; content: string }>;
  takeaways: string[];
  quiz: IngestionQuizQuestion[];
};

function text(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

export function extractJson(textValue: string) {
  const fenced = textValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : textValue).trim();
  if (candidate.startsWith('{') && candidate.endsWith('}')) return candidate;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) return candidate.slice(start, end + 1);
  throw new SyntaxError('The summary was not returned as JSON.');
}

export function parseIngestionSummary(value: unknown): IngestionSummary {
  if (!value || typeof value !== 'object') throw new Error('The source summary was invalid.');
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.concepts) || result.concepts.length < 3 || result.concepts.length > 7) throw new Error('The source summary did not include enough concepts.');
  if (!Array.isArray(result.takeaways) || result.takeaways.length < 3) throw new Error('The source summary did not include takeaways.');
  if (!Array.isArray(result.quiz) || result.quiz.length < 4 || result.quiz.length > 8) throw new Error('The source quiz was invalid.');

  const concepts = result.concepts.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('A source concept was invalid.');
    const concept = item as Record<string, unknown>;
    return { heading: text(concept.heading, `Concept ${index + 1}`, 120), content: text(concept.content, 'Review this concept in the original source material.', 1_600) };
  });
  const quiz = result.quiz.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('A quiz question was invalid.');
    const question = item as Record<string, unknown>;
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error('A quiz question needs four options.');
    const correctIndex = Number(question.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error('A quiz answer was invalid.');
    return { question: text(question.question, `Question ${index + 1}`, 350), options: question.options.map((option, optionIndex) => text(option, `Option ${optionIndex + 1}`, 220)), correctIndex, explanation: text(question.explanation, 'Review the source summary, then revisit this concept.', 500) };
  });
  return { title: text(result.title, 'Source concepts', 140), overview: text(result.overview, 'A concise overview of the material you added.', 1_000), concepts, takeaways: result.takeaways.slice(0, 6).map((item, index) => text(item, `Key takeaway ${index + 1}`, 220)), quiz };
}

export function toPublicIngestionSummary(summary: IngestionSummary) {
  return { ...summary, quiz: summary.quiz.map(({ correctIndex: _correctIndex, ...question }) => question) };
}
