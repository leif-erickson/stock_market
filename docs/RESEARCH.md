# Research ledger

Paper-only. Live stays off. This file is the human picker; `GET /research/board` is the agent query.

Do not copy TIA, Tori, Brooks, or other course text into this repo. Pointers by Drive id / URL only. Do not add facets. Do not size live from SQN.

## Honesty

`orb_breakout` walk-forward OOS **n=2**. Status is **unmeasured**, not profitable. Do not invent P&amp;L. **Do not compute SQN** (Tharp SQN needs n≥30; cap n at 100). Promotion in this repo still requires `minOosTrades` **8** (stricter than Tharp’s 30 for SQN grading) **and** not `anomaly_dependent`. This board never marks `live-eligible`.

## Lab OS (links only)

Walk-forward is the lab operating system. Grade **stitched OOS**. Keep **2–5 params** with a plateau. Optional later: Bailey–López de Prado PBO/CSCV — a robustness check, **not a 6th facet**.

- Tomasini &amp; Jaekle, *Trading Systems* (Harriman): [harriman-house.com/tradingsystems](https://www.harriman-house.com/tradingsystems)
- Pardo, *The Evaluation and Optimization of Trading Strategies* (Wiley): [wiley.com](https://www.wiley.com/en-us/The+Evaluation+and+Optimization+of+Trading+Strategies%2C+2nd+Edition-p-9780470128015)
- Bailey, Borwein, López de Prado, Zhu — PBO / CSCV: [ssrn.com/abstract=2326253](https://ssrn.com/abstract=2326253)

Measurement (paper only, not live size): Van Tharp R-multiple / expectancy / SQN. Official: [vantharp.com](https://www.vantharp.com/). SQN only when n≥30 (cap n at 100).

AMT as the **5m instrument book** (IB / value / participation), not extra confirms: Dalton *Mind Over Markets* (Wiley) · Steidlmayer / CBOT Market Profile ([CME education](https://www.cmegroup.com/education/courses/market-profile.html)).

State machine (language stolen, templates not copied): **specify → code → run_is → run_wf → paper_forward → iterate | kill | promote_queue**.

- [august-andersen/trading-hypothesis-workflow](https://github.com/august-andersen/trading-hypothesis-workflow)
- [charlesbx/quant-research-lab-template](https://github.com/charlesbx/quant-research-lab-template)

Discard confluence scores (e.g. TradePad 0–14). A setup still has 2–5 named facets, not a stacked score.

## Experiment slot

**One `school_book` per slot:** `amt` | `brooks` | `tori` | `gann` | `ict_smc` | `orderflow`. Never stack.

This week: **`amt`**. Brooks is a possible later 5m day-trade slot (Always-In / H2), not this week. Tori = 4h swing. Gann = D/W TIA swing (unparked). ICT/SMC + orderflow: later ES/NQ + L2 — not the default US-cash book.

## Books

| Book | school_book | Kind | Family | TF | Venue | Status | News | next_action |
|---|---|---|---|---|---|---|---|---|
| `stock_auction_5m` | amt | mechanical | high_beta | 5m | alpaca_paper | paper | skip NFP/CPI/FOMC | `run_wf` |
| `gann_swing` | gann | pattern | stocks | D/W | alpaca_paper | exploring | may run event mornings | `specify` |
| `tori_trendlines` | tori | pattern | stocks | 4h | alpaca_paper | exploring | may run event mornings | `specify` |
| `brooks_5m` | brooks | pattern | stocks | 5m | alpaca_paper | inbox | skip NFP/CPI/FOMC | `specify` |
| `ict_smc` | ict_smc | overlay | es_nq | 5m | later | inbox | n/a | `specify` |
| `orderflow` | orderflow | parked | es_nq | tick | rithmic_stub | parked | n/a | `specify` |
| `tia_wyckoff` | — | pattern | stocks | swing | alpaca_paper | inbox | earnings skip | `specify` |
| `tia_elliott` | — | pattern | stocks | swing | alpaca_paper | inbox | earnings skip | `specify` |
| `tia_time_overlay` | — | overlay | stocks | overlay | alpaca_paper | inbox | when, not a facet | `specify` |
| `tia_process` | — | process | all | n/a | journal | inbox | n/a | `paper_forward` |

Overnight stock swing is the **path** (pick `gann` or `tori`), not a stacked experiment. Facet budget still **2–5 per SETUP**.

## Next to explore

Rank: **exploring**, then **paper**, then **inbox**. Never promote live-eligible. One school_book in the experiment slot.

1. Gann D/W swing book (`specify`, exploring) — unparked; no detector this pass.
2. Tori 4h trendlines (`specify`, exploring) — not stacked on 5m ORB or on Gann.
3. AMT 5m auction (`run_wf`, paper) — this week’s slot. OOS n=2; skip NFP/CPI/FOMC already paper.
4. AVGO earnings skip 2026-09-02 (`paper_forward`, inbox).
5. Brooks 5m Always-In / H2 (`specify`, inbox) — later day-trade slot.
6. TIA Wyckoff / Elliott / time overlay (`specify`, inbox) — pointers only.
7. R-multiples as journal unit (`paper_forward`, inbox) — not live size.
8. ICT/SMC + orderflow (`specify`) — later ES/NQ + L2.

## Ledger fields

Optional on `strategy_ideas`. `GET /research/ideas` and `GET /research/edge` also return `nextToExplore`.

| Field | Meaning |
|---|---|
| `school` | Experiment slot: `amt` \| `brooks` \| `tori` \| `gann` \| `ict_smc` \| `orderflow`. Other labels (wyckoff, …) are pointers, not slots. |
| `book` | id from the matrix |
| `timeframe` | `5m`, `4h`, `D/W`, `overlay`, `tick` |
| `instrumentFamily` | `high_beta`, `stocks`, `single_name`, `es_nq`, … |
| `nextAction` | enum: `specify`, `code`, `run_is`, `run_wf`, `paper_forward`, `iterate`, `kill`, `promote_queue` |
| `sourceUrl` | Drive/URL pointer only |

Statuses: `inbox` → `exploring` → `paper` → `rejected` / `parked`. Ranking ignores rejected and parked. `promote_queue` is still paper.

## Pointers (ids/links only)

- TIA Investor / TIA Crypto (Jason & Michael Pizzino). Drive folder: [1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9](https://drive.google.com/drive/folders/1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9) (Gann Swing Accelerator lessons 02-09). PDF `The-Gann-Swing-Accelerator.pdf` id [`1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T`](https://drive.google.com/file/d/1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T). Same TIA tree also has Wyckoff Volume Accelerator and Elliott folders.
- Tori Trades trendlines (public method): action line + safety line; bounce vs 2/3-touch break; typically 4h; trail on opposing trendline.
- Al Brooks price action (later slot): [brookspriceaction.com](https://www.brookspriceaction.com/)
- TIA Premium Traders Guide *categories* to mirror (not text): mechanical vs pattern; R-multiples; advanced schools as separate courses; 7-step + trade log.

## News overlay

- **5m auction / Brooks later:** skip NFP/CPI/FOMC mornings (auction skip already paper).
- **Gann D/W and Tori 4h:** may still run those days.
- **All US-cash names:** single-name earnings skip (AVGO 2026-09-02 AC).

Query: `GET /research/board`. Named 5m edge: [STRATEGY.md](STRATEGY.md).
