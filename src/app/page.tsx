import Link from "next/link";
import Image from "next/image";
import { LandingHeader } from "@/components/landing-header";

const features = [
  ["01", "A real customer profile", "Sign in securely and manage the details attached to your Grat account."],
  ["02", "A clear request trail", "Submit transfer requests and follow their review status from one place."],
  ["03", "A recorded balance", "See ledger entries posted by staff after they confirm activity outside Grat."],
];

export default function LandingPage() {
  return <main className="landing">
    <LandingHeader />
    <section className="lp-hero space" aria-labelledby="landing-title"><div className="aurora" aria-hidden="true"/><div className="grid-floor" aria-hidden="true"/>
      <div className="lp-hero-in"><div className="hero-copy"><p className="kicker" style={{color:"#8fe3f5"}}>A CLEAR CUSTOMER PORTAL</p><h1 id="landing-title">Requests that feel <span className="grad">clear and calm.</span></h1><p className="lead">Create your Grat profile, submit transfer requests and follow staff updates in one place.</p><div className="lp-cta"><Link className="btn primary lg" href="/signup">Create an account</Link><Link className="btn lg on-dark" href="/login">Sign in</Link></div><div className="lp-trust"><span>◇ Private customer profile</span><span>↗ Manual review</span><span>✓ Clear status updates</span></div></div>
        <div className="hero-visual">
          <figure className="hero-photo">
            <Image className="hero-woman" src="/images/grat-hero-woman.jpg" alt="A woman working at her laptop in a bright home office" fill priority sizes="(max-width: 860px) 80vw, 470px" />
            <figcaption className="hp-cap"><span className="hp-dot" aria-hidden="true"/>Your Grat requests, in one place</figcaption>
          </figure>
          <div className="concept-debit-card" aria-label="Illustrative Grat debit card concept">
            <div className="concept-card-top"><span className="concept-card-brand"><i className="grat-brand-mark"/>Grat</span><span>DEBIT</span></div>
            <span className="concept-chip" aria-hidden="true"/><span className="concept-card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 4821</span>
            <div className="concept-card-foot"><span>ILLUSTRATIVE CONCEPT</span><span className="concept-card-mark">G</span></div>
          </div>
          <div className="grat-landing-preview"><div className="preview-head"><span>GRAT REQUEST CENTER</span><span className="pulse-dot"/></div><h2>One clear view of your requests</h2><p>Submit a request and follow it through staff review.</p><div className="mock-row"><span className="coin acct-b">↗</span><span className="grow">Transfer request</span><span className="tag pend">Under review</span></div><div className="mock-row"><span className="coin acct-g">✓</span><span className="grow">Account balance</span><span className="sub">Staff recorded</span></div></div>
        </div></div>
    </section>
    <section id="features" className="lp-section"><p className="kicker">A simple place to keep things clear</p><h2>What you can do with Grat</h2><p className="lead2">Grat currently handles customer profiles, transfer requests, staff reviews and ledger balances.</p><div className="feat-grid">{features.map(([num,title,text])=><article className="feat" key={num}><span className="ic">{num}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="how-it-works" className="lp-section" style={{paddingTop:0}}><p className="kicker">How it works</p><h2>From request to review</h2><div className="steps3"><article className="step3"><h3>Create your profile</h3><p>Register with your email and access your private customer portal.</p></article><article className="step3"><h3>Send a request</h3><p>Share the transfer details for staff review. Submitting does not move money.</p></article><article className="step3"><h3>Follow the update</h3><p>Track status and see ledger activity recorded by Grat staff.</p></article></div></section>
    <section className="lp-section space cta-band"><div className="aurora"/><h2>Keep every request in view.</h2><p>Sign in to your Grat profile or create one to get started.</p><div className="lp-cta" style={{justifyContent:"center"}}><Link className="btn primary" href="/signup">Create a profile</Link><Link className="btn on-dark" href="/login">Sign in</Link></div></section>
    <footer className="lp-foot"><div><Link href="/" className="brand"><span className="grat-brand-mark"/>Grat</Link><p className="sub">A customer request portal.</p></div><div><h3>Account</h3><Link className="link" href="/login">Sign in</Link><Link className="link" href="/signup">Create a profile</Link></div><div><h3>How Grat works</h3><a className="link" href="#features">Features</a><a className="link" href="#how-it-works">Request process</a></div><div><h3>Administration</h3><Link className="link" href="/admin/login">Admin sign in</Link></div></footer>
  </main>;
}
