export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type LessonContent = {
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
  keyTakeaways: string[];
  practicePrompt: string;
};

export type GeneratedLesson = { lesson: LessonContent; quiz: QuizQuestion[] };

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
  throw new SyntaxError('Claude did not return a JSON lesson.');
}

export function parseGeneratedLesson(value: unknown): GeneratedLesson {
  if (!value || typeof value !== 'object') throw new Error('Claude returned an invalid lesson.');
  const result = value as Record<string, unknown>;
  const rawLesson = result.lesson;
  if (!rawLesson || typeof rawLesson !== 'object') throw new Error('Claude returned a lesson without content.');
  const lesson = rawLesson as Record<string, unknown>;
  if (!Array.isArray(lesson.sections) || lesson.sections.length < 2 || lesson.sections.length > 8) throw new Error('Claude returned an invalid lesson structure.');
  if (!Array.isArray(lesson.keyTakeaways) || lesson.keyTakeaways.length < 2) throw new Error('Claude returned invalid lesson takeaways.');
  if (!Array.isArray(result.quiz) || result.quiz.length < 3 || result.quiz.length > 12) throw new Error('Claude returned an invalid quiz.');

  const sections = lesson.sections.map((section, index) => {
    if (!section || typeof section !== 'object') throw new Error('Claude returned an invalid lesson section.');
    const value = section as Record<string, unknown>;
    return { heading: text(value.heading, `Key idea ${index + 1}`, 100), content: text(value.content, 'Review this idea and connect it to your learning goal.', 2_000) };
  });
  const keyTakeaways = lesson.keyTakeaways.slice(0, 5).map((item, index) => text(item, `Key takeaway ${index + 1}`, 220));
  const quiz = result.quiz.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error('Claude returned an invalid quiz question.');
    const question = item as Record<string, unknown>;
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error('Claude returned quiz options in an invalid format.');
    const correctIndex = Number(question.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error('Claude returned an invalid quiz answer.');
    return {
      question: text(question.question, `Question ${index + 1}`, 350),
      options: question.options.map((option, optionIndex) => text(option, `Option ${optionIndex + 1}`, 220)),
      correctIndex,
      explanation: text(question.explanation, 'Review the relevant section, then try this concept again.', 500),
    };
  });

  return { lesson: { introduction: text(lesson.introduction, 'This lesson builds one practical step in your learning path.', 800), sections, keyTakeaways, practicePrompt: text(lesson.practicePrompt, 'Apply one idea from this lesson to a realistic situation.', 500) }, quiz };
}

export function toPublicLesson(generated: GeneratedLesson) {
  return { lesson: generated.lesson, quiz: generated.quiz.map(({ correctIndex: _correctIndex, ...question }) => question) };
}
