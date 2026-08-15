'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { LearnerStats } from '@/lib/gamification';

export type PlayerModule = {
  id: string;
  position: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  status: 'not_started' | 'completed';
};

export function CoursePlayer({ courseId, modules, initialStats }: { courseId: string; modules: PlayerModule[]; initialStats: LearnerStats }) {
  const completed = useMemo(() => modules.filter((module) => module.status === 'completed').length, [modules]);
  const progress = modules.length ? Math.round((completed / modules.length) * 100) : 0;
  const levelProgress = initialStats.totalXp % 300;

  return <section className="course-player" aria-label="Course modules"><div className="learning-stats"><div><span>LEVEL {initialStats.level}</span><strong>{initialStats.totalXp} XP</strong><i><b style={{ width: `${(levelProgress / 300) * 100}%` }} /></i><small>{300 - levelProgress || 300} XP to level {initialStats.level + 1}</small></div><div className="streak-badge"><span>🔥</span><strong>{initialStats.currentStreak}</strong><small>day streak</small></div></div><div className="course-progress-header"><div><span>YOUR PROGRESS</span><strong>{completed} of {modules.length} modules complete</strong></div><b>{progress}%</b></div><div className="course-progress-track"><i style={{ width: `${progress}%` }} /></div><div className="course-module-list">{modules.map((module) => <article className={module.status === 'completed' ? 'is-complete' : ''} key={module.id}><div className="module-summary"><span className="module-position">{String(module.position).padStart(2, '0')}</span><div><h2>{module.title}</h2><p>{module.description}</p><small>~{module.estimatedMinutes} minutes</small></div><div className="module-actions"><Link className="lesson-button" href={`/courses/${courseId}/modules/${module.id}`}>{module.status === 'completed' ? 'Review lesson' : 'Generate lesson →'}</Link>{module.status === 'completed' && <span className="module-complete-badge">Completed ✓</span>}</div></div></article>)}</div></section>;
}
