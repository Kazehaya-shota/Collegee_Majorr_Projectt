import Link from 'next/link';
import styles from './auth-screen.module.css';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const isSignIn = mode === 'sign-in';

  return (
    <main className={styles.layout}>
      <section className={styles.aside}>
        <Link className="brand" href="/" aria-label="Back to Zentrix home"><span className="brand-mark"><i /><i /><i /></span><span>zen<span>trix</span></span></Link>
        <div className={styles.asideCopy}><p className="eyebrow"><span className="pulse" /> YOUR LEARNING, IN ONE PLACE</p><h1>Make curiosity<br />a <em>practice.</em></h1><p>Save your paths, keep your progress, and return to the next meaningful step whenever you are ready.</p></div>
        <div className={styles.miniPath}><span>YOUR NEXT STEP</span><div><b>02</b><p><strong>Build a shared language</strong><small>Design systems for product teams · 18 min</small></p><i>→</i></div></div>
        <p className={styles.asideNote}>Made for steady learners, not perfect streaks.</p>
      </section>
      <section className={styles.panelArea}>
        <Link href="/" className={styles.backLink}>← Back to Zentrix</Link>
        <div className={styles.panel}>
          <div className={styles.tabs}><Link className={!isSignIn ? styles.active : ''} href="/sign-up">Join Zentrix</Link><Link className={isSignIn ? styles.active : ''} href="/sign-in">Sign in</Link></div>
          <p className={styles.kicker}>A small step toward your next big one</p>
          <h2>{isSignIn ? 'Welcome back' : 'Create your free account'}</h2>
          <p className={styles.description}>{isSignIn ? 'Pick up your learning path exactly where you left off.' : 'Keep every learning path, practice result, and small win in one place.'}</p>
          <form className={styles.form}><label className={isSignIn ? styles.hidden : ''}><span>Your name</span><input placeholder="What should we call you?" autoComplete="name" /></label><label><span>Email address</span><input type="email" placeholder="you@example.com" autoComplete="email" /></label><label><span>Password</span><input type="password" placeholder={isSignIn ? 'Enter your password' : 'Create a password'} autoComplete={isSignIn ? 'current-password' : 'new-password'} /></label><button type="button">{isSignIn ? 'Sign in to Zentrix' : 'Create my account'} <span>→</span></button></form>
          <div className={styles.divider}><span>or continue with</span></div>
          <div className={styles.socials}><button type="button"><b>G</b> Google</button><button type="button">● Apple</button></div>
          <p className={styles.terms}>Clerk authentication will be connected in the next implementation phase. By continuing, you agree to our Terms of Service and Privacy Policy.</p>
          <p className={styles.switch}>{isSignIn ? <>New to Zentrix? <Link href="/sign-up">Join free</Link></> : <>Already learning with us? <Link href="/sign-in">Sign in instead</Link></>}</p>
        </div>
      </section>
    </main>
  );
}
