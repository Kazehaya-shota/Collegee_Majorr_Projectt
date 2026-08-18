export default function Loading() {
  return <main className="route-loading" role="status" aria-live="polite">
    <div className="route-loading-mark" aria-hidden="true"><i /><i /><i /></div>
    <p>Varen</p>
    <strong>Preparing your learning space</strong>
    <span>Just a moment…</span>
  </main>;
}
