'use strict';

const { rankNextToExplore, publicIdea } = require('./research');

const MIN_OOS_TRADES = 8;

/**
 * Paper research ledger. Pointers only — no TIA/Tori course text.
 * Live stays off. This board never marks live-eligible.
 */

const TIA_DRIVE_FOLDER = 'https://drive.google.com/drive/folders/1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9';
const GANN_PDF_ID = '1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T';
const GANN_PDF_URL = `https://drive.google.com/file/d/${GANN_PDF_ID}`;

const SOURCES = {
  copyright: 'Pointers by id/link only. Do not copy TIA or Tori course text into this repo.',
  tia: {
    names: 'TIA Investor / TIA Crypto (Jason & Michael Pizzino)',
    driveFolder: TIA_DRIVE_FOLDER,
    gannPdfId: GANN_PDF_ID,
    gannPdfUrl: GANN_PDF_URL,
    gannVideos: 'Gann Swing Accelerator lessons 02-09 in the Drive folder',
    alsoFolders: ['Wyckoff Volume Accelerator', 'Elliott'],
    categoriesToMirror: [
      'mechanical vs pattern',
      'R-multiples (journal unit, not live size)',
      'advanced schools as separate courses/books',
      '7-step + trade log',
    ],
  },
  tori: {
    names: 'Tori Trades trendlines (public method)',
    publicNotes: 'action line + safety line; bounce vs 2/3-touch break; typically 4h swing; trail on opposing trendline',
    driveId: null,
    url: null,
  },
};

/** school × instrument family × timeframe × venue × status × next action + news overlay */
const RESEARCH_BOOKS = [
  {
    id: 'stock_auction_5m',
    school: 'amt',
    kind: 'mechanical',
    instrumentFamily: 'high_beta',
    timeframe: '5m',
    venue: 'alpaca_paper',
    status: 'paper',
    newsOverlay: 'skip_nfp_cpi_fomc',
    nextAction: 'Keep measuring walk-forward OOS. News skip is already paper. Do not add facets.',
    note: 'Named 5m day-trade edge. OR=IB, VWAP=value, rvol=participation. Facet budget 2–5.',
  },
  {
    id: 'gann_swing',
    school: 'gann',
    kind: 'pattern',
    instrumentFamily: 'stocks',
    timeframe: 'swing',
    venue: 'alpaca_paper',
    status: 'exploring',
    newsOverlay: 'may_run_event_mornings',
    nextAction: 'Book is unparked. Do not implement a detector this pass. Geometry/time squares later.',
    note: 'Own swing/cycle book. Not a 6th confirm on the 5m ORB auction.',
    sourceUrl: TIA_DRIVE_FOLDER,
  },
  {
    id: 'tori_trendlines',
    school: 'tori',
    kind: 'pattern',
    instrumentFamily: 'stocks',
    timeframe: '4h',
    venue: 'alpaca_paper',
    status: 'exploring',
    newsOverlay: 'may_run_event_mornings',
    nextAction: 'Named swing-book method. Do not stack on 5m ORB. No detector this pass.',
    note: 'Separate swing book. Path to un-park overnight stock swing.',
  },
  {
    id: 'overnight_swing',
    school: 'gann+tori',
    kind: 'pattern',
    instrumentFamily: 'stocks',
    timeframe: 'swing',
    venue: 'alpaca_paper',
    status: 'exploring',
    newsOverlay: 'may_run_event_mornings',
    nextAction: 'Treat Gann + Tori as this track. Still paper. No live overnight book.',
    note: 'Overnight swing book = Gann+Tori track. Was parked; this is the un-park path.',
  },
  {
    id: 'tia_wyckoff',
    school: 'wyckoff',
    kind: 'pattern',
    instrumentFamily: 'stocks',
    timeframe: 'swing',
    venue: 'alpaca_paper',
    status: 'inbox',
    newsOverlay: 'single_name_earnings_skip',
    nextAction: 'Later TIA course/book. Pointer only.',
    sourceUrl: TIA_DRIVE_FOLDER,
  },
  {
    id: 'tia_elliott',
    school: 'elliott',
    kind: 'pattern',
    instrumentFamily: 'stocks',
    timeframe: 'swing',
    venue: 'alpaca_paper',
    status: 'inbox',
    newsOverlay: 'single_name_earnings_skip',
    nextAction: 'Later TIA course/book. Pointer only.',
    sourceUrl: TIA_DRIVE_FOLDER,
  },
  {
    id: 'tia_time_overlay',
    school: 'gann',
    kind: 'overlay',
    instrumentFamily: 'stocks',
    timeframe: 'overlay',
    venue: 'alpaca_paper',
    status: 'inbox',
    newsOverlay: 'when_overlay',
    nextAction: 'Time analysis overlays when, not extra entry facets.',
    sourceUrl: TIA_DRIVE_FOLDER,
  },
  {
    id: 'smc_tags',
    school: 'smc',
    kind: 'overlay',
    instrumentFamily: 'stocks',
    timeframe: '5m',
    venue: 'alpaca_paper',
    status: 'optional_tags',
    newsOverlay: 'skip_nfp_cpi_fomc',
    nextAction: 'Keep as optional researchTags. Not confirms. Instrument-specific later book if ever.',
  },
  {
    id: 'vsa_tags',
    school: 'vsa',
    kind: 'overlay',
    instrumentFamily: 'stocks',
    timeframe: '5m',
    venue: 'alpaca_paper',
    status: 'optional_tags',
    newsOverlay: 'skip_nfp_cpi_fomc',
    nextAction: 'Keep as optional researchTags. Not confirms.',
  },
  {
    id: 'orderflow',
    school: 'orderflow',
    kind: 'parked',
    instrumentFamily: 'futures_then_stocks',
    timeframe: 'tick',
    venue: 'rithmic_stub',
    status: 'parked',
    newsOverlay: 'n/a',
    nextAction: 'NOT_IMPLEMENTED until L2/Rithmic. Do not invent CVD from 5m OHLCV.',
  },
  {
    id: 'tia_process',
    school: 'process',
    kind: 'process',
    instrumentFamily: 'all',
    timeframe: 'n/a',
    venue: 'journal',
    status: 'inbox',
    newsOverlay: 'n/a',
    nextAction: 'Mirror TIA categories: R-multiples as journal unit; 7-step + trade log. Not live size.',
  },
];

const NEWS_OVERLAY = {
  skip_nfp_cpi_fomc: '5m auction skips NFP/CPI/FOMC mornings (already paper).',
  may_run_event_mornings: 'Gann/Tori higher-TF books may still run NFP/CPI/FOMC days.',
  single_name_earnings_skip: 'Single-name earnings skip (AVGO 2026-09-02 AC).',
  when_overlay: 'Time overlays answer when, not a 6th entry facet.',
  'n/a': 'No news overlay on this book.',
};

const CATALOG_IDEAS = [
  {
    id: 'catalog:gann-swing',
    title: 'Gann swing/cycle as its own book',
    hypothesis: 'Unpark Gann as a higher-TF swing/cycle book. Not a 6th confirm on the 5m ORB auction. Geometry/time squares later; no detector this pass.',
    status: 'exploring',
    school: 'gann',
    book: 'gann_swing',
    timeframe: 'swing',
    instrumentFamily: 'stocks',
    nextAction: 'Keep as book ledger only. Do not add facets to orb_breakout.',
    sourceUrl: TIA_DRIVE_FOLDER,
    source: 'catalog',
    exploreRank: 1,
  },
  {
    id: 'catalog:tori-trendlines',
    title: 'Tori trendlines overnight swing method',
    hypothesis: 'Public method: action line + safety line; bounce vs 2/3-touch break; typically 4h; trail on opposing trendline. Separate swing book, not stacked on 5m ORB.',
    status: 'exploring',
    school: 'tori',
    book: 'tori_trendlines',
    timeframe: '4h',
    instrumentFamily: 'stocks',
    nextAction: 'Name the swing-book method. Do not implement a detector this pass.',
    sourceUrl: null,
    source: 'catalog',
    exploreRank: 2,
  },
  {
    id: 'catalog:overnight-swing',
    title: 'Overnight swing book is the Gann+Tori track',
    hypothesis: 'Overnight stock swing was parked. Un-park it as its own book via Gann + Tori, not by stacking on 5m ORB.',
    status: 'exploring',
    school: 'gann+tori',
    book: 'overnight_swing',
    timeframe: 'swing',
    instrumentFamily: 'stocks',
    nextAction: 'Keep paper. No live overnight book.',
    source: 'catalog',
    exploreRank: 3,
  },
  {
    id: 'catalog:auction-news-skip',
    title: 'Skip 5m auction on NFP/CPI/FOMC mornings',
    hypothesis: 'Opening-range auction fails more on NFP/CPI/FOMC mornings. Paper this skip. Not a sixth facet. Gann/Tori higher-TF books may still run those days.',
    status: 'paper',
    school: 'amt',
    book: 'stock_auction_5m',
    timeframe: '5m',
    instrumentFamily: 'high_beta',
    nextAction: 'Keep paper measuring. Do not treat skip as an entry confirm.',
    source: 'catalog',
    exploreRank: 4,
  },
  {
    id: 'catalog:orb-oos-honesty',
    title: 'Only orb_breakout has an OOS path so far',
    hypothesis: 'Do not invent profitability. minOosTrades is 8. If OOS n<8, status is unmeasured, not most profitable. Walk-forward OOS and not anomaly_dependent are still required.',
    status: 'paper',
    school: 'amt',
    book: 'stock_auction_5m',
    timeframe: '5m',
    instrumentFamily: 'high_beta',
    nextAction: 'Measure OOS n honestly. This board never promotes live-eligible.',
    source: 'catalog',
    exploreRank: 5,
  },
  {
    id: 'catalog:avgo-earnings-skip',
    title: 'Skip AVGO into 2026-09-02 earnings',
    hypothesis: 'Single-name earnings skip. AVGO 2026-09-02 after close. Overlay, not a sixth 5m facet.',
    status: 'inbox',
    school: 'amt',
    book: 'stock_auction_5m',
    timeframe: '5m',
    instrumentFamily: 'single_name',
    nextAction: 'Paper as a skip overlay on the auction book.',
    symbols: ['AVGO'],
    source: 'catalog',
    exploreRank: 6,
  },
  {
    id: 'catalog:tia-wyckoff',
    title: 'TIA Wyckoff Volume Accelerator as a later book',
    hypothesis: 'Advanced school as its own course/book when explored. Not stacked on 5m ORB facets.',
    status: 'inbox',
    school: 'wyckoff',
    book: 'tia_wyckoff',
    timeframe: 'swing',
    instrumentFamily: 'stocks',
    nextAction: 'Pointer only. Open the TIA Drive Wyckoff folder when ready.',
    sourceUrl: TIA_DRIVE_FOLDER,
    source: 'catalog',
    exploreRank: 7,
  },
  {
    id: 'catalog:tia-elliott',
    title: 'TIA Elliott as a later book',
    hypothesis: 'Advanced school as its own course/book when explored. Not stacked on 5m ORB facets.',
    status: 'inbox',
    school: 'elliott',
    book: 'tia_elliott',
    timeframe: 'swing',
    instrumentFamily: 'stocks',
    nextAction: 'Pointer only. Open the TIA Drive Elliott folder when ready.',
    sourceUrl: TIA_DRIVE_FOLDER,
    source: 'catalog',
    exploreRank: 8,
  },
  {
    id: 'catalog:tia-time-overlay',
    title: 'TIA time analysis as a when-overlay',
    hypothesis: 'Time masterclasses overlay when, not extra entry facets. Facet budget stays 2–5 per setup.',
    status: 'inbox',
    school: 'gann',
    book: 'tia_time_overlay',
    timeframe: 'overlay',
    instrumentFamily: 'stocks',
    nextAction: 'Keep as overlay note. Do not add a 6th facet.',
    sourceUrl: TIA_DRIVE_FOLDER,
    source: 'catalog',
    exploreRank: 9,
  },
  {
    id: 'catalog:r-multiples',
    title: 'R-multiples as journal unit',
    hypothesis: 'Mirror TIA Premium Traders Guide category: R is the journal unit, not live size yet. Mechanical vs pattern is a book label.',
    status: 'inbox',
    school: 'process',
    book: 'tia_process',
    timeframe: 'n/a',
    instrumentFamily: 'all',
    nextAction: 'Use R in journal notes. Do not size live from it.',
    source: 'catalog',
    exploreRank: 10,
  },
];

function catalogKey(idea) {
  const book = String(idea.book || idea.book_id || '').toLowerCase();
  const title = String(idea.title || '').toLowerCase();
  const id = String(idea.id || '');
  return { id, book, title };
}

function isSameIdea(a, b) {
  const ka = catalogKey(a);
  const kb = catalogKey(b);
  if (ka.id && kb.id && ka.id === kb.id) return true;
  if (ka.book && kb.book && ka.book === kb.book && ka.title && ka.title === kb.title) return true;
  if (ka.book && kb.book && ka.book === kb.book && String(a.school || '') === String(b.school || '')) {
    return true;
  }
  if (ka.title && ka.title === kb.title) return true;
  return false;
}

function mergeExploreQueue(storedIdeas = []) {
  const stored = (storedIdeas || []).map((row) => publicIdea(row));
  const extra = CATALOG_IDEAS.filter(
    (c) => !stored.some((s) => isSameIdea(s, c))
  ).map((c) => publicIdea(c));
  return rankNextToExplore([...stored, ...extra]);
}

function oosHonesty(setups = []) {
  const minOosTrades = MIN_OOS_TRADES;
  const rows = (setups || []).map((s) => {
    const trades = Number(s.metrics?.trades ?? s.metrics?.oosTrades ?? 0);
    return {
      id: s.id,
      oosTrades: trades,
      status: trades >= minOosTrades ? 'measured' : 'unmeasured',
    };
  });
  return {
    onlySetupWithOosPath: 'orb_breakout',
    minOosTrades,
    note: 'Do not invent profitability. If OOS n<8, status is unmeasured not most profitable. Walk-forward OOS and not anomaly_dependent are still required.',
    setups: rows,
  };
}

function boardSnapshot({ ideas = [], setups = [] } = {}) {
  return {
    liveEligibleFromBoard: false,
    execution: 'paper',
    honesty: oosHonesty(setups),
    books: RESEARCH_BOOKS.map((b) => ({
      ...b,
      newsNote: NEWS_OVERLAY[b.newsOverlay] || NEWS_OVERLAY['n/a'],
    })),
    nextToExplore: mergeExploreQueue(ideas),
    sources: SOURCES,
    news: {
      auction5m: NEWS_OVERLAY.skip_nfp_cpi_fomc,
      higherTfSwing: NEWS_OVERLAY.may_run_event_mornings,
      earnings: NEWS_OVERLAY.single_name_earnings_skip,
    },
  };
}

module.exports = {
  MIN_OOS_TRADES,
  TIA_DRIVE_FOLDER,
  GANN_PDF_ID,
  GANN_PDF_URL,
  SOURCES,
  RESEARCH_BOOKS,
  NEWS_OVERLAY,
  CATALOG_IDEAS,
  mergeExploreQueue,
  oosHonesty,
  boardSnapshot,
};
