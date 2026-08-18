export const AI_COURSE_GENERATION_ORIGIN = 'ai_course_generator' as const;
export const CONTENT_INGESTION_ORIGIN = 'content_ingestion' as const;
export const YOUTUBE_TO_COURSE_ORIGIN = 'youtube_to_course' as const;

export const COURSE_ORIGIN_STORAGE_KEY = 'varen-pending-course-origin';

export type CourseOrigin =
  | typeof AI_COURSE_GENERATION_ORIGIN
  | typeof CONTENT_INGESTION_ORIGIN
  | typeof YOUTUBE_TO_COURSE_ORIGIN;

export function parseCourseOrigin(value: unknown): CourseOrigin {
  if (value === CONTENT_INGESTION_ORIGIN || value === YOUTUBE_TO_COURSE_ORIGIN) return value;
  return AI_COURSE_GENERATION_ORIGIN;
}

export function isCertificateEligibleOrigin(value: unknown) {
  return value === AI_COURSE_GENERATION_ORIGIN;
}
