# Research ledger

Paper-only. Live stays off. This file is the human picker; `GET /research/board` is the agent query.

Do not copy TIA or Tori course text into this repo. Pointers by Drive id / URL only.

## Honesty

Only `orb_breakout` has a walk-forward OOS path so far. `minOosTrades` is 8. If OOS n&lt;8, status is **unmeasured**, not “most profitable.” Do not invent profitability. Walk-forward OOS **and** not `anomaly_dependent` are still required. This board never marks `live-eligible`.

## Books

| Book | School | Kind | Instrument family | TF | Venue | Status | News overlay | Next action |
|---|---|---|---|---|---|---|---|---|
| `stock_auction_5m` | amt | mechanical | high_beta | 5m | alpaca_paper | paper | skip NFP/CPI/FOMC mornings | Keep measuring OOS. News skip already paper. |
| `gann_swing` | gann | pattern | stocks | swing | alpaca_paper | exploring | may run event mornings | Unparked as its own book. No detector this pass. |
| `tori_trendlines` | tori | pattern | stocks | 4h | alpaca_paper | exploring | may run event mornings | Named swing-book method. Not stacked on 5m ORB. |
| `overnight_swing` | gann+tori | pattern | stocks | swing | alpaca_paper | exploring | may run event mornings | This is the un-park track for overnight stock swing. |
| `tia_wyckoff` | wyckoff | pattern | stocks | swing | alpaca_paper | inbox | earnings skip | Later TIA course/book. Pointer only. |
| `tia_elliott` | elliott | pattern | stocks | swing | alpaca_paper | inbox | earnings skip | Later TIA course/book. Pointer only. |
| `tia_time_overlay` | gann | overlay | stocks | overlay | alpaca_paper | inbox | when, not a facet | Time analysis overlays *when*, not a 6th confirm. |
| `smc_tags` | smc | overlay | stocks | 5m | alpaca_paper | optional_tags | skip event mornings | Optional `researchTags`. Not confirms. Later book if ever. |
| `vsa_tags` | vsa | overlay | stocks | 5m | alpaca_paper | optional_tags | skip event mornings | Optional `researchTags`. Not confirms. |
| `orderflow` | orderflow | parked | futures_then_stocks | tick | rithmic_stub | parked | n/a | `OrderflowSession` → `NOT_IMPLEMENTED` until L2/Rithmic. |
| `tia_process` | process | process | all | n/a | journal | inbox | n/a | R-multiples as journal unit; 7-step + trade log. Not live size. |

Facet budget is still **2–5 per SETUP**. Books can be many; a setup cannot grow past 5 facets. Gann and Tori are books, not facets.

## Next to explore

Rank: **exploring**, then **paper**, then **inbox**. Never promote live-eligible from this list.

1. Gann swing/cycle as its own book (exploring) — geometry/time squares later; no detector this pass.
2. Tori trendlines overnight swing method (exploring) — action + safety line; typically 4h.
3. Overnight swing = Gann+Tori track (exploring).
4. Skip 5m auction on NFP/CPI/FOMC mornings (paper).
5. Measure `orb_breakout` OOS honestly (paper). n&lt;8 → unmeasured.
6. Skip AVGO into 2026-09-02 earnings (inbox).
7. TIA Wyckoff Volume Accelerator later book (inbox).
8. TIA Elliott later book (inbox).
9. TIA time analysis as a when-overlay (inbox).
10. R-multiples as journal unit (inbox).

## Ledger fields

Optional on `strategy_ideas` (backward compatible). `GET /research/ideas` and `GET /research/edge` also return `nextToExplore`.

| Field | Meaning |
|---|---|
| `school` | amt, gann, tori, wyckoff, elliott, smc, vsa, orderflow, process |
| `book` | id from the matrix above |
| `timeframe` | `5m`, `4h`, `swing`, `overlay`, `tick` |
| `instrumentFamily` | `high_beta`, `stocks`, `single_name`, `all`, … |
| `nextAction` | what a human or agent should do next |
| `sourceUrl` | Drive/URL pointer only |

Statuses: `inbox` → `exploring` → `paper` → `rejected` / `parked`. Ranking ignores rejected and parked.

## Pointers (ids/links only)

- TIA Investor / TIA Crypto (Jason & Michael Pizzino). Drive folder: [1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9](https://drive.google.com/drive/folders/1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9) (Gann Swing Accelerator lessons 02-09). PDF `The-Gann-Swing-Accelerator.pdf` id [`1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T`](https://drive.google.com/file/d/1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T). Same TIA tree also has Wyckoff Volume Accelerator and Elliott folders.
- Tori Trades trendlines (public method, no Drive id here): action line + safety line; bounce vs 2/3-touch break; typically 4h swing; trail on opposing trendline.
- TIA Premium Traders Guide *categories* to mirror (not text): mechanical vs pattern; R-multiples; advanced schools as separate courses; 7-step + trade log.

## News overlay

- **5m auction:** skip NFP/CPI/FOMC mornings (already paper).
- **Gann / Tori / overnight swing:** may still run those days (higher TF).
- **All books:** single-name earnings skip (AVGO 2026-09-02 AC).

Query: `GET /research/board`. Named 5m edge: [STRATEGY.md](STRATEGY.md).
