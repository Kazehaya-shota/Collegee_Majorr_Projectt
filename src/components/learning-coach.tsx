'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };

function pageLabel(pathname: string) {
  if (pathname.includes('/modules/')) return 'this lesson';
  if (pathname.includes('/courses/')) return 'this course';
  if (pathname.includes('content-ingestion')) return 'your learning material';
  if (pathname.includes('youtube-to-course')) return 'this YouTube source';
  if (pathname.includes('interview-prep')) return 'your interview practice';
  if (pathname.includes('course-generator')) return 'your new learning path';
  if (pathname.includes('learning-path')) return 'your learning path';
  return 'your learning today';
}

function suggestions(pathname: string) {
  if (pathname.includes('/modules/')) return ['Explain this simply', 'Give me an example', 'Help me revise this'];
  if (pathname.includes('interview-prep')) return ['Improve my answer', 'Give me a STAR example', 'What should I practise?'];
  if (pathname.includes('content-ingestion')) return ['Help choose a study focus', 'What should I summarize?', 'Make a revision plan'];
  return ['What should I learn next?', 'Make me a revision plan', 'Explain a concept simply'];
}

export function LearningCoach() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const welcome: Message = { role: 'assistant', content: `I’m here to help with ${pageLabel(pathname)}. Ask for an explanation, an example, or a focused next step.` };

  useEffect(() => {
    if (!open || !isSignedIn || historyLoaded) return;
    void (async () => {
      try {
        const response = await fetch('/api/coach');
        const payload = await response.json() as { messages?: Message[]; conversationId?: string };
        if (response.ok && payload.messages?.length) setMessages(payload.messages);
        if (payload.conversationId) setConversationId(payload.conversationId);
      } catch {
        // The coach can still start a fresh conversation if history is unavailable.
      } finally { setHistoryLoaded(true); }
    })();
  }, [open, isSignedIn, historyLoaded]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading, open]);

  function startFresh() {
    setMessages([]);
    setConversationId('');
    setInput('');
    setError('');
  }

  async function send(event?: FormEvent<HTMLFormElement>, messageOverride?: string) {
    event?.preventDefault();
    const message = (messageOverride ?? input).trim();
    if (!message || loading) return;
    if (!isSignedIn) { setError('Sign in to chat with your learning coach.'); return; }
    const nextMessages = [...messages, { role: 'user' as const, content: message }];
    setMessages(nextMessages); setInput(''); setLoading(true); setError('');
    try {
      const response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, pathname, conversationId, history: messages }) });
      const payload = await response.json() as { reply?: string; conversationId?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || 'Your learning coach could not reply.');
      setMessages((current) => [...current, { role: 'assistant', content: payload.reply! }]);
      if (payload.conversationId) setConversationId(payload.conversationId);
    } catch (requestError) {
      setMessages(messages);
      setError(requestError instanceof Error ? requestError.message : 'Your learning coach could not reply.');
    } finally { setLoading(false); }
  }

  return <aside className={`learning-coach-widget${open ? ' is-open' : ''}`} aria-label="Learning Coach">
    {open && <section className="learning-coach-panel">
      <header><div><span>VAREN COACH</span><strong>Your learning companion</strong><small><i /> Ready when you are</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close learning coach">×</button></header>
      {!isLoaded ? <div className="coach-loading">Opening your coach…</div> : !isSignedIn ? <div className="coach-signed-out"><span>✦</span><strong>Save your learning conversations.</strong><p>Sign in to ask Varen&apos;s coach for course and revision help.</p><Link href="/sign-in">Sign in →</Link></div> : <><div className="coach-thread" ref={scrollRef}>{(messages.length ? messages : [welcome]).map((message, index) => <article key={`${message.role}-${index}`} className={`coach-message is-${message.role}`}><span>{message.role === 'assistant' ? '✦' : 'You'}</span><p>{message.content}</p></article>)}{loading && <article className="coach-message is-assistant coach-typing"><span>✦</span><p><i /><i /><i /></p></article>}</div>{!messages.length && <div className="coach-suggestions">{suggestions(pathname).map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(undefined, suggestion)}>{suggestion}</button>)}</div>}<form onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask about ${pageLabel(pathname)}…`} rows={2} maxLength={1400} /><button type="submit" disabled={!input.trim() || loading} aria-label="Send message">↑</button></form>{error && <p className="coach-error">{error}</p>}<footer><button type="button" onClick={startFresh}>New conversation</button><span>AI learning support</span></footer></>}
    </section>}
    <button className="learning-coach-trigger" type="button" onClick={() => setOpen((current) => !current)} aria-label={open ? 'Close Learning Coach' : 'Open Learning Coach'} aria-expanded={open}><span>{open ? '×' : '✦'}</span>{!open && <i />}</button>
  </aside>;
}
