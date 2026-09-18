# SEO tracking — tetherlinkutility.com

Recurring SERP-visibility checks for this site, kept comparable across time.

- `serp-check-config.md` — the fixed 100-keyword set + methodology. Reuse verbatim on every re-run;
  don't regenerate a new keyword list, or dates stop being comparable.
- `serp-checks/<date>.md` — one file per run, full per-keyword result table. Never edit a past
  run's file; add a new dated file instead.
- `history-summary.md` — one-line-per-run rollup for a quick trend glance without opening every
  detail file.

To run a new check: reuse the keyword list in `serp-check-config.md`, execute the same way (10
parallel search calls per batch, 10 batches), save the new dated file under `serp-checks/`, and
append a row to `history-summary.md`.
