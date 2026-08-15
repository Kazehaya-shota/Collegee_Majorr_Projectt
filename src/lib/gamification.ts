import type { SupabaseClient } from '@supabase/supabase-js';

export type LearnerStats = {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
};

type StoredStats = {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const XP_PER_LEVEL = 300;

function asStats(stats: StoredStats): LearnerStats {
  return { totalXp: stats.total_xp, level: stats.level, currentStreak: stats.current_streak, longestStreak: stats.longest_streak };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(date: string, currentDate: string) {
  return new Date(`${currentDate}T00:00:00.000Z`).getTime() - new Date(`${date}T00:00:00.000Z`).getTime() === DAY_MS;
}

export async function getLearnerStats(supabase: SupabaseClient, userId: string): Promise<LearnerStats> {
  const { data, error } = await supabase.from('learner_stats').select('total_xp, level, current_streak, longest_streak, last_activity_date').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? asStats(data as StoredStats) : { totalXp: 0, level: 1, currentStreak: 0, longestStreak: 0 };
}

export async function awardExperience(supabase: SupabaseClient, userId: string, xp: number, activityType: 'lesson' | 'quiz' | 'course' | 'interview') {
  const { error: profileError } = await supabase.from('profiles').upsert({ clerk_user_id: userId }, { onConflict: 'clerk_user_id' });
  if (profileError) throw profileError;

  const { data, error } = await supabase.from('learner_stats').select('total_xp, level, current_streak, longest_streak, last_activity_date').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const previous = (data as StoredStats | null) ?? { total_xp: 0, level: 1, current_streak: 0, longest_streak: 0, last_activity_date: null };
  const currentDate = today();
  const streak = previous.last_activity_date === currentDate
    ? previous.current_streak
    : isYesterday(previous.last_activity_date ?? '', currentDate) ? previous.current_streak + 1 : 1;
  const totalXp = previous.total_xp + xp;
  const statsRow = {
    user_id: userId,
    total_xp: totalXp,
    level: Math.floor(totalXp / XP_PER_LEVEL) + 1,
    current_streak: streak,
    longest_streak: Math.max(previous.longest_streak, streak),
    last_activity_date: currentDate,
  };
  const { error: statsError } = await supabase.from('learner_stats').upsert(statsRow, { onConflict: 'user_id' });
  if (statsError) throw statsError;
  const { error: activityError } = await supabase.from('learning_activity').insert({ user_id: userId, activity_type: activityType, xp_earned: xp, activity_date: currentDate });
  if (activityError) throw activityError;
  return { stats: asStats({ ...statsRow, last_activity_date: currentDate }), earnedXp: xp };
}
