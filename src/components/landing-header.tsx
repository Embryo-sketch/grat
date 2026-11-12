"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <header className={`lp-head${scrolled ? " solid" : ""}`}>
      <Link href="/" className="brand" aria-label="Grat home"><span className="grat-brand-mark"/>Grat</Link>
      <nav className="lp-nav"><a href="#how-it-works">How it works</a><a href="#features">Features</a></nav>
      <span className="sp"/>
      <Link className="btn" href="/login">Sign in</Link>
      <Link className="btn primary" href="/signup">Create a profile</Link>
    </header>
  );
}
