import { useState, useEffect, useRef } from 'react';
import { useBinderCoo } from './useBinderCoo';
import './App.css';

// Defaults come from Vite env vars (injected at build time on Vercel:
// VITE_BINDER_GATEWAY_URL / VITE_BINDER_AUTH_TOKEN / VITE_BINDER_USER_ID).
// If unset, the connect form starts empty and the user must paste them in.
// NOTE: Vite VITE_* vars are bundled into the client JS — they are not truly
// secret. For production, render the token into the page template server-side
// (see README "Production notes").
const STAGING = {
  gatewayUrl: import.meta.env.VITE_BINDER_GATEWAY_URL ?? '',
  authToken: import.meta.env.VITE_BINDER_AUTH_TOKEN ?? '',
  userId: import.meta.env.VITE_BINDER_USER_ID ?? '',
};

function renderMarkdown(text) {
  const safe = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return safe
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function ConfigForm({ initial, onSubmit }) {
  const [gatewayUrl, setGatewayUrl] = useState(initial.gatewayUrl);
  const [authToken, setAuthToken] = useState(initial.authToken);
  const [userId, setUserId] = useState(initial.userId);

  return (
    <div className="config-overlay">
      <div className="config-box">
        <h2>Connect to Binder COO</h2>
        <p>Staging endpoint prefilled. From the v2.0 integration doc.</p>
        <label>Gateway URL</label>
        <input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} />
        <label>Auth token</label>
        <input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} />
        <label>User ID (Binder users.id UUID)</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button
          onClick={() => {
            if (!gatewayUrl || !authToken || !userId) return;
            onSubmit({ gatewayUrl, authToken, userId });
          }}
        >
          Connect
        </button>
      </div>
    </div>
  );
}

function StateBadge({ state }) {
  const cls =
    state === 'ready' ? 'badge ok' :
    state === 'auth-failed' ? 'badge err' :
    state === 'disconnected' || state === 'retrying' ? 'badge warn' :
    'badge';
  return <span className={cls}>{state}</span>;
}

export default function App() {
  const [cfg, setCfg] = useState(() => {
    const saved = localStorage.getItem('binder-coo-cfg');
    return saved ? JSON.parse(saved) : null;
  });
  const [input, setInput] = useState('');
  const logRef = useRef(null);

  const { state, identity, messages, error, send } = useBinderCoo(cfg);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const ready = state === 'ready';

  function submit() {
    const text = input.trim();
    if (!text || !ready) return;
    send(text);
    setInput('');
  }

  function saveCfg(next) {
    localStorage.setItem('binder-coo-cfg', JSON.stringify(next));
    setCfg(next);
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>Binder COO</h1>
          <div className="sub">
            {identity?.handle ? `Logged in as ${identity.handle}` : 'Web chat — React + v2.0 proxy'}
          </div>
        </div>
        <StateBadge state={state} />
      </header>

      {error && state === 'auth-failed' && (
        <div className="banner err">Chat unavailable — {error.message ?? error.code}. Check token / userId.</div>
      )}
      {state === 'retrying' && <div className="banner warn">Reconnecting…</div>}

      <div className="log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble-wrap ${m.role}`}>
            {m.toolChips && m.toolChips.length > 0 && (
              <div className="chips">
                {m.toolChips.map((c) => (
                  <span key={c.id} className={`chip ${c.done ? 'done' : ''}`}>
                    {c.done ? '✓' : '▸'} {c.name}
                  </span>
                ))}
              </div>
            )}
            <div
              className={`bubble ${m.role}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
            />
          </div>
        ))}
      </div>

      <footer>
        <textarea
          rows={1}
          disabled={!ready}
          placeholder={ready ? 'Ask anything overdue, vendor exposure, factory codes…' : 'Waiting for connection…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button onClick={submit} disabled={!ready}>Send</button>
      </footer>

      {!cfg && <ConfigForm initial={STAGING} onSubmit={saveCfg} />}
    </div>
  );
}
