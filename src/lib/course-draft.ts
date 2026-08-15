export type CourseModule = {
  number: string;
  title: string;
  description: string;
  estimatedMinutes: number;
};

export type CourseDraft = {
  title: string;
  summary: string;
  estimatedMinutes: number;
  modules: CourseModule[];
};

function ensureString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function parseCourseDraft(value: unknown): CourseDraft {
  if (!value || typeof value !== 'object') throw new Error('Claude returned an invalid course draft.');
  const draft = value as Record<string, unknown>;
  if (!Array.isArray(draft.modules) || draft.modules.length < 3 || draft.modules.length > 8) {
    throw new Error('Claude returned a course outline with an invalid number of modules.');
  }

  const modules = draft.modules.map((module, index) => {
    if (!module || typeof module !== 'object') throw new Error('Claude returned an invalid module.');
    const item = module as Record<string, unknown>;
    const estimatedMinutes = Number(item.estimatedMinutes);
    return {
      number: String(index + 1).padStart(2, '0'),
      title: ensureString(item.title, `Module ${index + 1}`),
      description: ensureString(item.description, 'A focused practice-based learning module.'),
      estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes > 0 ? Math.round(estimatedMinutes) : 25,
    };
  });

  const estimatedMinutes = Number(draft.estimatedMinutes);
  return {
    title: ensureString(draft.title, 'Your personalized learning path'),
    summary: ensureString(draft.summary, 'A focused, practical course designed around your learning goal.'),
    estimatedMinutes: Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
      ? Math.round(estimatedMinutes)
      : modules.reduce((total, module) => total + module.estimatedMinutes, 0),
    modules,
  };
}
