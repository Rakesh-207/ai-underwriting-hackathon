export function MarketingFooter() {
  return (
    <footer id="footer" className="bg-surface" aria-labelledby="footer-heading">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-12 sm:px-8 lg:px-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 id="footer-heading" className="text-sm font-semibold text-ink">Underwriting / Simulation</h2>
          <p className="mt-3 max-w-[52ch] text-sm leading-6 text-muted">A focused demonstration of consented signals, evidence, and explainable review.</p>
        </div>
        <nav className="flex gap-5 text-sm text-muted" aria-label="Footer navigation">
          <a className="hover:text-ink" href="#methodology">Explainability</a>
          <a className="hover:text-ink" href="#safety">Trust</a>
        </nav>
      </div>
    </footer>
  );
}
