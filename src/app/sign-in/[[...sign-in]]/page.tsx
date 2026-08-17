import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import styles from '@/components/auth-screen.module.css';

export default function SignInPage() {
  return <main className={styles.layout}><section className={styles.aside}><Link className="brand" href="/" aria-label="Back to Zentrix home"><span className="brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link><div className={styles.asideCopy}><p className="eyebrow"><span className="pulse" /> WELCOME BACK</p><h1>Make curiosity<br />a <em>practice.</em></h1><p>Continue with the path you made for yourself, one meaningful lesson at a time.</p></div><p className={styles.asideNote}>Your learning paths stay ready whenever you are.</p></section><section className={styles.panelArea}><Link href="/" className={styles.backLink}>← Back to Zentrix</Link><div className={styles.clerkPanel}><SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" /></div></section></main>;
}
