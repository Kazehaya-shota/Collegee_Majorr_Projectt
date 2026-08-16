'use client';

import { useEffect, useMemo, useState } from 'react';
import { ReportButton } from '@/components/report-button';
import type { StudyGroup } from '@/components/community-group-discover';

export function CommunityGroupReportPicker({ groups }: { groups: StudyGroup[] }) {
  const reportable = useMemo(() => groups.filter((group) => !group.isMine), [groups]);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSelectedId((current) => current || reportable[0]?.id || '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reportable]);
  const selected = reportable.find((group) => group.id === selectedId);
  if (!selected) return null;
  return <aside className="community-report-picker"><span>KEEPING COMMUNITY SPACE USEFUL</span><div><label>See a group that needs attention?<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{reportable.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}</select></label><ReportButton targetType="group" targetId={selected.id} /></div></aside>;
}
