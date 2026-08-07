export function MarketingFooter() {
  return (
    <footer id="footer" className="bg-surface" aria-labelledby="footer-heading">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 id="footer-heading" className="text-sm font-semibold text-ink">Underwriting Simulation</h2>
          <p className="mt-3 max-w-[52ch] text-sm leading-6 text-muted">A lender-side decision-support demonstration. Simulation results are not official credit scores, approvals, denials, or lending decisions.</p>
        </div>
        <nav className="flex gap-5 text-sm text-muted" aria-label="Footer navigation">
          <a className="hover:text-ink" href="#methodology">Methodology</a>
          <a className="hover:text-ink" href="#safety">Safety</a>
        </nav>
      </div>
    </footer>
  );
}
