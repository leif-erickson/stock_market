'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { rankNextToExplore, normalizeIdea, LEDGER_FIELDS } = require('../lib/research');
const {
  MIN_OOS_TRADES,
  TIA_DRIVE_FOLDER,
  GANN_PDF_ID,
  RESEARCH_BOOKS,
  CATALOG_IDEAS,
  boardSnapshot,
  mergeExploreQueue,
} = require('../lib/researchBoard');
const { SETUPS, PROMOTION_GATES, loadConfig, edgeSnapshot } = require('../lib/config');
const { createMemoryStore } = require('../lib/store');

describe('research board / next-to-explore ledger', () => {
  it('declares optional ledger fields and ranks exploring/paper before inbox', () => {
    assert.deepEqual(LEDGER_FIELDS, [
      'school', 'book', 'timeframe', 'instrumentFamily', 'nextAction', 'sourceUrl',
    ]);
    const ranked = rankNextToExplore([
      { id: 3, title: 'inbox later', status: 'inbox', hypothesis: 'x' },
      { id: 1, title: 'exploring first', status: 'exploring', hypothesis: 'x' },
      { id: 2, title: 'paper second', status: 'paper', hypothesis: 'x' },
      { id: 4, title: 'rejected out', status: 'rejected', hypothesis: 'x' },
      { id: 5, title: 'parked out', status: 'parked', hypothesis: 'x' },
    ]);
    assert.deepEqual(ranked.map((i) => i.title), [
      'exploring first',
      'paper second',
      'inbox later',
    ]);
    assert.equal(ranked.every((i) => i.liveEligible === false), true);
  });

  it('never promotes live-eligible from a ranking even if a row claims it', () => {
    const ranked = rankNextToExplore([
      { id: 1, title: 'sneaky', status: 'exploring', liveEligible: true, hypothesis: 'x' },
    ]);
    assert.equal(ranked[0].liveEligible, false);
    const board = boardSnapshot({ ideas: ranked, setups: SETUPS });
    assert.equal(board.liveEligibleFromBoard, false);
    assert.equal(board.execution, 'paper');
    assert.equal(board.honesty.minOosTrades, 8);
    assert.equal(board.honesty.minOosTrades, PROMOTION_GATES.minOosTrades);
    assert.equal(board.honesty.onlySetupWithOosPath, 'orb_breakout');
    assert.match(board.honesty.note, /unmeasured/);
    const orb = board.honesty.setups.find((s) => s.id === 'orb_breakout');
    assert.equal(orb.status, 'unmeasured');
  });

  it('treats Gann and Tori as books, not SETUPS facets', () => {
    const gann = RESEARCH_BOOKS.find((b) => b.id === 'gann_swing');
    const tori = RESEARCH_BOOKS.find((b) => b.id === 'tori_trendlines');
    const overnight = RESEARCH_BOOKS.find((b) => b.id === 'overnight_swing');
    assert.equal(gann.school, 'gann');
    assert.equal(gann.status, 'exploring');
    assert.equal(tori.school, 'tori');
    assert.equal(overnight.school, 'gann+tori');
    for (const setup of SETUPS) {
      assert.equal(setup.facets.includes('gann'), false);
      assert.equal(setup.facets.includes('tori'), false);
      assert.ok(setup.facets.length <= 5);
    }
    const orderflow = RESEARCH_BOOKS.find((b) => b.id === 'orderflow');
    assert.equal(orderflow.status, 'parked');
    assert.match(orderflow.nextAction, /NOT_IMPLEMENTED/);
  });

  it('merges catalog ideas so an empty store still has a next-to-explore queue', () => {
    const queue = mergeExploreQueue([]);
    assert.ok(queue.length >= CATALOG_IDEAS.length);
    assert.equal(queue[0].status, 'exploring');
    assert.ok(queue.some((i) => i.book === 'gann_swing'));
    assert.ok(queue.some((i) => i.book === 'tori_trendlines'));
    assert.ok(queue.some((i) => i.status === 'paper'));
    assert.ok(queue.some((i) => i.status === 'inbox'));
    const statuses = queue.map((i) => i.status);
    const lastExploring = statuses.lastIndexOf('exploring');
    const firstPaper = statuses.indexOf('paper');
    const lastPaper = statuses.lastIndexOf('paper');
    const firstInbox = statuses.indexOf('inbox');
    assert.ok(lastExploring < firstPaper);
    assert.ok(lastPaper < firstInbox);
    assert.equal(queue.every((i) => i.liveEligible === false), true);
  });

  it('lets a stored exploring idea override the matching catalog book', async () => {
    const store = createMemoryStore();
    await store.insertIdea(normalizeIdea({
      title: 'Human Gann note',
      hypothesis: 'Operator filed this.',
      status: 'exploring',
      school: 'gann',
      book: 'gann_swing',
    }));
    const ideas = await store.listIdeas();
    const queue = mergeExploreQueue(ideas);
    const gannRows = queue.filter((i) => i.book === 'gann_swing');
    assert.equal(gannRows.length, 1);
    assert.equal(gannRows[0].title, 'Human Gann note');
  });

  it('exposes next-to-explore on the edge snapshot without enabling live', () => {
    const edge = edgeSnapshot(loadConfig());
    assert.equal(edge.liveEligibleFromBoard, false);
    assert.equal(edge.maxFacets, 5);
    assert.ok(edge.nextToExplore[0].status === 'exploring');
    assert.equal(MIN_OOS_TRADES, 8);
  });

  it('points at TIA Drive ids only and does not embed course text', () => {
    const md = fs.readFileSync(path.join(__dirname, '../../docs/RESEARCH.md'), 'utf8');
    assert.match(md, /1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9/);
    assert.match(md, /1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T/);
    assert.match(md, /Do not copy TIA or Tori course text/);
    assert.match(md, /unmeasured/);
    assert.match(md, /orb_breakout/);
    assert.match(TIA_DRIVE_FOLDER, /1nyq_yaY-vvcZiS5pJxHDjAlHhI7jnbf9/);
    assert.equal(GANN_PDF_ID, '1YFGU7ACqUb_IiR2a2rSoQe58JJu23v2T');
    assert.doesNotMatch(md, /square of nine lesson/i);
  });
});
