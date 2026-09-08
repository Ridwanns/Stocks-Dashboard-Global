# What to collect

Drop PDFs in this folder as `financials/<TICKER>/<period>-<type>.pdf`.
Exact names don't matter — ticker, period and document type do.

## Don't collect these

Nine figures already arrive automatically through `fetch_quotes.py`, quarterly
and annual, for all five names: **revenue, cost of revenue, gross profit, R&D,
SG&A, operating income, EBITDA, net income, diluted EPS**, plus total assets,
liabilities, equity, cash, debt, inventory, receivables, operating cash flow,
capex and free cash flow.

Analyst price targets and float aren't in any filing either — those need a
data provider, not a PDF.

## Collect these — 10 files

Only four things in the dashboard can't be derived from an API:

| Fills | From |
| --- | --- |
| `segments` — revenue split | earnings press release, or the segment note |
| guidance → `scenarios` | **earnings press release only** |
| `risks` | 10-K Item 1A (TSM: 20-F Item 3.D) |
| `moat`, `one_liner` | 10-K Item 1 (TSM: 20-F Item 4) |

### One annual report each

| Ticker | Document | Period | Filed | EDGAR |
| --- | --- | --- | --- | --- |
| NVDA | 10-K FY2026 | 2026-01-25 | 2026-02-25 | [CIK 0001045810](https://www.sec.gov/edgar/browse/?CIK=0001045810) |
| AMD | 10-K FY2025 | 2025-12-27 | 2026-02-04 | [CIK 0000002488](https://www.sec.gov/edgar/browse/?CIK=0000002488) |
| MU | 10-K FY2025 | 2025-08-28 | 2025-10-03 | [CIK 0000723125](https://www.sec.gov/edgar/browse/?CIK=0000723125) |
| MRVL | 10-K FY2026 | 2026-01-31 | 2026-03-11 | [CIK 0001835632](https://www.sec.gov/edgar/browse/?CIK=0001835632) |
| TSM | **20-F** FY2025 | 2025-12-31 | 2026-04-16 | [CIK 0001046179](https://www.sec.gov/edgar/browse/?CIK=0001046179) |

### One earnings release each

The press release, not the 10-Q — guidance appears only in the release. On
EDGAR it is an **8-K, Exhibit 99.1**; easier to grab from the company's IR
"Quarterly Results" page, where the release and the slide deck sit together.

| Ticker | Most recent quarter | Period ended |
| --- | --- | --- |
| NVDA | FY2027 Q2 | 2026-07-26 |
| AMD | Q2 2026 | 2026-06-27 |
| MU | FY2026 Q3 | 2026-05-28 |
| MRVL | FY2027 Q2 | 2026-08-01 |
| TSM | Q2 2026 (**6-K**) | 2026-06-30 |

## Three traps

**TSM files no 10-K and no 10-Q.** It is a foreign private issuer: 20-F once a
year, 6-K for interim results. Its statements are also in **New Taiwan
dollars** — taken as USD, its quarterly revenue looks ~4000% higher than the
seeded figure.

**Micron's FY2026 10-K isn't out yet.** Its fiscal year closed 2026-09-03; the
filing usually lands in early October. FY2025 is the latest available.

**NVIDIA has no Q4 10-Q.** The closing quarter is folded into the 10-K, so the
sequence looks like it skips one.

## Fiscal calendars

Read from each company's SEC `fiscalYearEnd`, so the quarter labels differ:
the quarter ending 2026-07-31 is **Q2 FY2027** for NVDA and MRVL, while
2026-05-31 is **Q3 FY2026** for Micron.

| Ticker | Year ends | 10-K lands |
| --- | --- | --- |
| NVDA, MRVL | late January | Feb–Mar |
| AMD, TSM | late December | Feb (TSM: Apr, 20-F) |
| MU | early September | October |
