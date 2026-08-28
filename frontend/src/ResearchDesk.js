import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

function money(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Number(value).toFixed(2)}`;
}

function pct(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

function ResearchDesk({ api }) {
  const [goals, setGoals] = useState(null);
  const [events, setEvents] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [candles, setCandles] = useState({ bars: 0, symbols: [] });
  const [edge, setEdge] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventForm, setEventForm] = useState({
    kind: 'macro', source: 'lynalden.com', title: '', url: '', body: '', symbols: '',
  });
  const [ideaForm, setIdeaForm] = useState({
    title: '', hypothesis: '', source: 'ui', symbols: '',
  });

  const refresh = useCallback(async () => {
    try {
      const [g, e, i, c, edgeRes] = await Promise.all([
        axios.get(`${api}/research/goals`),
        axios.get(`${api}/research/events?limit=20`),
        axios.get(`${api}/research/ideas?limit=20`),
        axios.get(`${api}/research/candles/stats`),
        axios.get(`${api}/research/edge`),
      ]);
      setGoals(g.data);
      setEvents(e.data.events || []);
      setIdeas(i.data.ideas || []);
      setCandles(c.data);
      setEdge(edgeRes.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [api]);

  useEffect(() => { refresh(); }, [refresh]);

  const addEvent = async () => {
    setBusy(true);
    try {
      await axios.post(`${api}/research/events`, {
        ...eventForm,
        symbols: eventForm.symbols,
      });
      setEventForm({ ...eventForm, title: '', url: '', body: '', symbols: '' });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const addIdea = async () => {
    setBusy(true);
    try {
      await axios.post(`${api}/research/ideas`, ideaForm);
      setIdeaForm({ title: '', hypothesis: '', source: 'ui', symbols: '' });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const setIdeaStatus = async (id, status) => {
    await axios.patch(`${api}/research/ideas/${id}`, { status });
    await refresh();
  };

  const ingestCandles = async () => {
    setBusy(true);
    try {
      await axios.post(`${api}/research/candles/ingest`, { days: 20 });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      {error ? <p className="error">{error}</p> : null}
      <section className="banner">
        <strong>Named edge.</strong> {edge?.namedEdge || 'Stock auction: opening range + VWAP + rvol; flatten by close.'}
        <div className="hint">
          Max {edge?.maxFacets ?? 5} facets.
          Frozen holdouts: {(edge?.frozenWindows || []).map((w) => `${w.start}–${w.end} (${w.regime})`).join('; ') || 'Oct–Nov 2025'}.
          One experiment slot from ideas below — do not add facets because last week was green.
        </div>
      </section>

      <div className="cards">
        <article>
          <h3>Capital goal (not a gate)</h3>
          <p>Start {money(goals?.startingCash)} → target {money(goals?.targetEquity)}</p>
          <p>Horizon {goals?.doubleDays ?? '—'} days · required {pct(goals?.requiredDailyReturnPct)}</p>
          <p>OOS implied days-to-double {goals?.oosDaysToDouble == null ? '—' : Math.round(goals.oosDaysToDouble)}</p>
          <p className="hint">{goals?.warning}</p>
        </article>
        <article>
          <h3>Candle archive</h3>
          <p>{candles.bars} bars · {(candles.symbols || []).join(', ') || 'no symbols yet'}</p>
          <p className="hint">Persist 5m Alpaca (or synthetic) bars, then review techniques in the journal.</p>
          <button onClick={ingestCandles} disabled={busy}>{busy ? 'Working…' : 'Ingest latest bars'}</button>
        </article>
      </div>

      <section>
        <h2>Strategy ideas</h2>
        <p className="hint">Grokbot can POST /agent/ideas from Slack. Status starts at inbox; exploring / paper / rejected are human calls.</p>
        <div className="actions">
          <input placeholder="Title" value={ideaForm.title} onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })} />
          <input placeholder="Hypothesis" value={ideaForm.hypothesis} onChange={(e) => setIdeaForm({ ...ideaForm, hypothesis: e.target.value })} />
          <input placeholder="Symbols" value={ideaForm.symbols} onChange={(e) => setIdeaForm({ ...ideaForm, symbols: e.target.value })} />
          <button onClick={addIdea} disabled={busy}>Add idea</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Idea</th>
              <th>Source</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((idea) => (
              <tr key={idea.id}>
                <td>
                  <div>{idea.title}</div>
                  <div className="hint">{idea.hypothesis}</div>
                </td>
                <td>{idea.source}{(idea.symbols || []).length ? ` · ${(idea.symbols || []).join(', ')}` : ''}</td>
                <td><span className="tag paper">{idea.status}</span></td>
                <td>
                  <button onClick={() => setIdeaStatus(idea.id, 'exploring')}>explore</button>{' '}
                  <button onClick={() => setIdeaStatus(idea.id, 'paper')}>paper</button>{' '}
                  <button onClick={() => setIdeaStatus(idea.id, 'rejected')}>reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Events (news, analysis, macro, indicators)</h2>
        <p className="hint">Store a URL plus a short note. Example source: lynalden.com for fiscal/liquidity regime. Do not dump paywalled full text.</p>
        <div className="actions">
          <select value={eventForm.kind} onChange={(e) => setEventForm({ ...eventForm, kind: e.target.value })}>
            <option value="news">news</option>
            <option value="analysis">analysis</option>
            <option value="macro">macro</option>
            <option value="indicator">indicator</option>
            <option value="other">other</option>
          </select>
          <input placeholder="Source" value={eventForm.source} onChange={(e) => setEventForm({ ...eventForm, source: e.target.value })} />
          <input placeholder="Title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} />
          <input placeholder="URL" value={eventForm.url} onChange={(e) => setEventForm({ ...eventForm, url: e.target.value })} />
          <input placeholder="Symbols" value={eventForm.symbols} onChange={(e) => setEventForm({ ...eventForm, symbols: e.target.value })} />
          <input placeholder="Note" value={eventForm.body} onChange={(e) => setEventForm({ ...eventForm, body: e.target.value })} />
          <button onClick={addEvent} disabled={busy}>Add event</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Title</th>
              <th>Source</th>
              <th>Symbols</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.kind}</td>
                <td>
                  <div>{ev.url ? <a href={ev.url} target="_blank" rel="noreferrer">{ev.title}</a> : ev.title}</div>
                  {ev.body ? <div className="hint">{ev.body}</div> : null}
                </td>
                <td>{ev.source}</td>
                <td>{(ev.symbols || []).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

export default ResearchDesk;
