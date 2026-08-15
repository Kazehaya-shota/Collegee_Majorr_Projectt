export type CourseSource = {
  sourceType: 'link' | 'note';
  label: string;
  url?: string;
  sourceText?: string;
};

function shortText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function parseCourseSources(value: unknown): CourseSource[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 5).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const sourceType = source.sourceType === 'link' ? 'link' : source.sourceType === 'note' ? 'note' : null;
    const label = shortText(source.label, 120);
    const url = shortText(source.url, 1_500);
    const sourceText = shortText(source.sourceText, 16_000);
    if (!sourceType || !label) return [];
    if (sourceType === 'link' && !url) return [];
    if (sourceType === 'note' && !sourceText) return [];
    return [{ sourceType, label, ...(url ? { url } : {}), ...(sourceText ? { sourceText } : {}) }];
  });
}
