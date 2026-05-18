// BinderCooClient — UI-agnostic adapter for the Binder COO chat proxy (v2.0).
// Wire protocol: JSON frames over WebSocket. See Binder-Web-integration.pdf.

export class BinderCooClient {
  constructor({ gatewayUrl, authToken, userId, autoReconnect = true }) {
    this.cfg = { gatewayUrl, authToken, userId, autoReconnect };
    this.handlers = new Map();
    this.state = 'idle';
    this.attempt = 0;
    this.activeRunId = null;
    this.ws = null;
  }

  on(event, fn) {
    if (!this.handlers.get(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
  }
  off(event, fn) { this.handlers.get(event)?.delete(fn); }
  _emit(event, payload) {
    this.handlers.get(event)?.forEach((fn) => { try { fn(payload); } catch { /* swallow */ } });
  }
  _setState(s) { this.state = s; this._emit('state', s); }

  connect() {
    if (this.ws && this.ws.readyState <= 1) { try { this.ws.close(); } catch { /* noop */ } }
    this._setState('connecting');
    const ws = (this.ws = new WebSocket(this.cfg.gatewayUrl));

    ws.onopen = () => {
      this._setState('authenticating');
      ws.send(JSON.stringify({
        type: 'req', id: 'auth-1', method: 'auth',
        params: { token: this.cfg.authToken, user: this.cfg.userId },
      }));
    };

    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }

      if (m.type === 'res' && m.id === 'auth-1') {
        if (!m.ok) {
          this._setState('auth-failed');
          this._emit('error', { code: m.error?.code ?? 'unauthorized', message: m.error?.message });
          return;
        }
        this._emit('identity', m.payload?.identity);
        return;
      }
      if (m.type === 'event' && m.event === 'proxy.ready') {
        this.attempt = 0;
        this._setState('ready');
        return;
      }
      if (m.type === 'event' && m.event === 'chat') {
        const p = m.payload;
        if (p.runId !== this.activeRunId) return;
        const text = p.message?.content?.[0]?.text ?? '';
        if (p.state === 'delta') this._emit('delta', text);
        else if (p.state === 'final') { this._emit('final', text); this.activeRunId = null; }
        else if (p.state === 'aborted' || p.state === 'error') {
          this._emit('error', { code: p.state, message: p.errorMessage });
          this.activeRunId = null;
        }
        return;
      }
      if (m.type === 'event' && m.event === 'agent' && m.payload?.data?.kind === 'tool') {
        this._emit('tool', m.payload.data);
      }
    };

    ws.onclose = (ev) => {
      if (ev.code === 4001 || ev.code === 4000 || ev.code === 4002) {
        this._setState('auth-failed');
        this._emit('error', { code: ev.reason || 'unauthorized', closeCode: ev.code });
        return;
      }
      this._setState('disconnected');
      if (this.cfg.autoReconnect) this._scheduleReconnect();
    };

    ws.onerror = () => { /* surfaced via onclose */ };
  }

  _scheduleReconnect() {
    const delayMs = Math.min(1000 * Math.pow(2, this.attempt), 30_000);
    this.attempt++;
    this._setState('retrying');
    this._emit('retry', { in: delayMs });
    setTimeout(() => this.connect(), delayMs);
  }

  send(message) {
    if (this.state !== 'ready') throw new Error(`cannot send while state=${this.state}`);
    const idempotencyKey = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.activeRunId = idempotencyKey;
    this.ws.send(JSON.stringify({
      type: 'req', id: `r-${Date.now()}`, method: 'chat.send',
      params: { message, idempotencyKey },
    }));
  }

  abort() {
    if (this.activeRunId) {
      this.ws.send(JSON.stringify({
        type: 'req', id: `a-${Date.now()}`, method: 'chat.abort',
        params: { runId: this.activeRunId },
      }));
    }
  }

  close() {
    this.cfg.autoReconnect = false;
    try { this.ws?.close(); } catch { /* noop */ }
  }
}
