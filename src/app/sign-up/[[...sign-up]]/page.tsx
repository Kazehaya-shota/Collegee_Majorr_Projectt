import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import styles from '@/components/auth-screen.module.css';

export default function SignUpPage() {
  return <main className={styles.layout}><section className={styles.aside}><Link className="brand" href="/" aria-label="Back to Zentrix home"><span className="brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link><div className={styles.asideCopy}><p className="eyebrow"><span className="pulse" /> YOUR LEARNING, IN ONE PLACE</p><h1>Make curiosity<br />a <em>practice.</em></h1><p>Save your paths, keep your progress, and return to the next meaningful step whenever you are ready.</p></div><div className={styles.miniPath}><span>YOUR NEXT STEP</span><div><b>02</b><p><strong>Build a shared language</strong><small>Design systems for product teams · 18 min</small></p><i>→</i></div></div><p className={styles.asideNote}>Made for steady learners, not perfect streaks.</p></section><section className={styles.panelArea}><Link href="/" className={styles.backLink}>← Back to Zentrix</Link><div className={styles.clerkPanel}><SignUp fallbackRedirectUrl="/dashboard" signInUrl="/sign-in" /></div></section></main>;
}
