'use client';

import { FormEvent, useState } from 'react';

type TargetType = 'group' | 'room' | 'post' | 'reply' | 'resource' | 'resource_comment';

export function ReportButton({ targetType, targetId, compact = false }: { targetType: TargetType; targetId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/community/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, reason: form.get('reason'), details: form.get('details') }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'We could not send that report.');
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not send that report.');
    } finally { setBusy(false); }
  }

  if (sent) return <span className="report-sent">Report sent</span>;
  return <span className={`report-control${compact ? ' is-compact' : ''}`}><button type="button" onClick={() => setOpen((current) => !current)}>⚐ Report</button>{open && <form onSubmit={submit}><select name="reason" defaultValue="inappropriate" aria-label="Report reason"><option value="inappropriate">Inappropriate content</option><option value="harassment">Harassment or bullying</option><option value="spam">Spam</option><option value="unsafe">Unsafe content</option><option value="other">Other concern</option></select><input name="details" placeholder="Optional details" maxLength={600} /><button disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>{error && <small>{error}</small>}</form>}</span>;
}
