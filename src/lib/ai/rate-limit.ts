import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type AiAction = 'course_generation' | 'course_refinement';

const LIMITS: Record<AiAction, { maxRequests: number; windowSeconds: number }> = {
  course_generation: { maxRequests: 8, windowSeconds: 60 * 60 },
  course_refinement: { maxRequests: 16, windowSeconds: 60 * 60 },
};

export class AiRateLimitSetupError extends Error {
  constructor() {
    super('AI request limits are not configured. Run the AI request limits SQL migration first.');
  }
}

export async function consumeAiRequest(userId: string, action: AiAction) {
  const limit = LIMITS[action];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('consume_ai_request', {
    p_user_id: userId,
    p_action: action,
    p_max_requests: limit.maxRequests,
    p_window_seconds: limit.windowSeconds,
  });

  if (error || typeof data !== 'boolean') {
    console.error('AI request limit check failed', error);
    throw new AiRateLimitSetupError();
  }
  return data;
}

export function aiRateLimitMessage(action: AiAction) {
  return action === 'course_generation'
    ? 'You have reached the course-generation limit for this hour. Please try again shortly.'
    : 'You have reached the course-editing limit for this hour. Please try again shortly.';
}
