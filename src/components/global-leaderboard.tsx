import { clerkClient } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type LeaderboardRow = {
  user_id: string;
  total_xp: number;
  level: number;
};

type LeaderboardEntry = LeaderboardRow & {
  name: string;
};

function learnerName(person: { firstName: string | null; lastName: string | null; username: string | null }) {
  const firstName = person.firstName?.trim();
  const lastInitial = person.lastName?.trim().slice(0, 1);

  if (firstName) return `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`;
  return person.username?.trim() || 'CourseMaster learner';
}

function initial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || 'C';
}

export async function GlobalLeaderboard({ currentUserId }: { currentUserId: string }) {
  let leaderboard: LeaderboardEntry[] = [];

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('learner_stats')
      .select('user_id, total_xp, level')
      .gt('total_xp', 0)
      .order('total_xp', { ascending: false })
      .limit(6);

    if (error) throw error;

    const rows = (data ?? []) as LeaderboardRow[];
    const clerk = await clerkClient();
    const names = await Promise.all(rows.map(async (row) => {
      try {
        const person = await clerk.users.getUser(row.user_id);
        return [row.user_id, learnerName(person)] as const;
      } catch {
        return [row.user_id, 'CourseMaster learner'] as const;
      }
    }));
    const nameByUserId = new Map(names);
    leaderboard = rows.map((row) => ({ ...row, name: nameByUserId.get(row.user_id) || 'CourseMaster learner' }));
  } catch (error) {
    console.error('Global leaderboard loading failed', error);
  }

  return <article className="app-leaderboard-card" aria-label="Global XP leaderboard">
    <header>
      <div>
        <p>GLOBAL LEADERBOARD</p>
        <h2>Learning leaders.</h2>
      </div>
      <span>LIVE XP</span>
    </header>
    {leaderboard.length ? <ol>
      {leaderboard.map((learner, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-standard';
        const isCurrentUser = learner.user_id === currentUserId;
        return <li key={learner.user_id} className={`leaderboard-entry ${rankClass}${isCurrentUser ? ' is-current-user' : ''}`}>
          <span className="leaderboard-place">{rank}</span>
          <span className="leaderboard-avatar">{initial(learner.name)}</span>
          <div><strong>{learner.name}{isCurrentUser && <small>You</small>}</strong><span>Level {learner.level}</span></div>
          <b>{learner.total_xp.toLocaleString()} <small>XP</small></b>
        </li>;
      })}
    </ol> : <div className="app-leaderboard-empty">
      <span>♛</span>
      <div><strong>The leaderboard is ready.</strong><p>Earn XP from lessons, quizzes, and courses to take the first spot.</p></div>
    </div>}
  </article>;
}
