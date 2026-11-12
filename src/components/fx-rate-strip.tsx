"use client";

import { useEffect, useState } from "react";

type RateFeed = { base: string; timestamp: string; rates: Record<string, number> };
const pairs = [
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "CAD", symbol: "C$" },
];

const rateFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function FxRateStrip() {
  const [feed, setFeed] = useState<RateFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const response = await fetch("https://fxapi.app/api/usd.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Rate feed unavailable");
        const next = await response.json() as RateFeed;
        if (!next.rates?.EUR || !next.rates?.GBP || !next.rates?.JPY || !next.timestamp) throw new Error("Rate feed response is incomplete");
        if (active) { setFeed(next); setFailed(false); }
      } catch {
        if (active) setFailed(true);
      }
    };
    void update();
    const interval = window.setInterval(() => void update(), 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const updatedAt = feed ? new Date(feed.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;

  return <div className="fx-strip-wrap">
    <div className="fx-strip" aria-label="Indicative US dollar exchange rates" aria-live="polite">
      {pairs.map(({ code, symbol }) => <div className="fx-rate" key={code}>
        <span className={`fx-currency fx-${code.toLowerCase()}`} aria-hidden="true">{symbol}</span>
        <span className="fx-pair">USD/{code}</span>
        <strong>{feed ? rateFormat.format(feed.rates[code]) : "—"}</strong>
      </div>)}
    </div>
    <p className="fx-attribution">
      {failed && !feed ? "Rates are temporarily unavailable." : feed ? `Indicative rates · Updated ${updatedAt}` : "Loading current rates…"}
      {feed && <> · <a href="https://fxapi.app/" target="_blank" rel="noreferrer">Rate source</a></>}
    </p>
  </div>;
}
