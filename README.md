# Binder COO — React Web Chat (v2.0)

React + Vite client that talks to the Binder COO chat proxy over WebSocket. Follows
the v2.0 wire protocol from `Binder-Web-integration.pdf`.

Same agent, same prompts, same tools the Telegram bot uses — different transport.

## Run locally

```bash
cp .env.example .env.local   # fill in token + userId
npm install
npm run dev                   # needs Node 20.19+ or 22.x
```

The connect dialog is prefilled from `VITE_*` env vars; if they're unset the
fields are empty and you paste them in by hand.

| Env var                    | Example                                           |
|----------------------------|---------------------------------------------------|
| `VITE_BINDER_GATEWAY_URL`  | `wss://binder-coo.tail2db2f3.ts.net/`             |
| `VITE_BINDER_AUTH_TOKEN`   | _(per-tenant secret — do not commit)_             |
| `VITE_BINDER_USER_ID`      | _(your Binder `users.id` UUID)_                    |

## Deploy on Vercel

1. Import this repo in Vercel.
2. Project Settings → Environment Variables → add the three `VITE_BINDER_*`.
3. Deploy. Vercel injects them at build time.

> **Vite caveat:** `VITE_*` variables are bundled into the client JS at build
> time — anyone viewing the page source can read them. For real production,
> render `authToken` into the page template server-side at request time (see
> _Production notes_) rather than baking it into the bundle.

Try: *"anything overdue today?"*, *"which vendor has the most exposure?"*,
*"FC-122 — what's the story?"*

## Files

- `src/binderCooClient.js` — UI-agnostic WebSocket adapter (~120 lines). Handles
  auth handshake, terminal close codes (4001/4000/4002 don't retry), exponential
  reconnect, cumulative delta replacement, tool-call events.
- `src/useBinderCoo.js` — React hook wrapping the adapter. Returns
  `{ state, identity, messages, error, send }`.
- `src/App.jsx` — chat UI: header with state badge, scrolling log of bubbles,
  tool-call chips, input footer, first-load config modal.
- `src/App.css` — styles.

## Wire protocol cheat-sheet

```
client ─► WS open
client ─► { type:"req", method:"auth",      params:{token,user} }
server ◄─ { type:"res", ok:true, payload:{ identity, sessionKey } }
server ◄─ { type:"event", event:"proxy.ready" }     ← now ready
client ─► { type:"req", method:"chat.send", params:{message, idempotencyKey} }
server ◄─ { type:"event", event:"chat", payload:{ state:"delta", message:{...} } }  // cumulative
server ◄─ { type:"event", event:"chat", payload:{ state:"final", message:{...} } }
```

`sessionKey` is server-derived from `userId` — same user across reloads gets the
same persistent memory; different users are fully isolated.

## Production notes

- `authToken` is a server-side secret in production — render it into the page
  template at request time, never bundle it.
- Bind `userId` to your actual logged-in user, not a hardcoded value.
- Provision each Binder user in `agent_user_mapping` server-side before they can
  reach the agent.

## Stack

Vite + React (JS). No TypeScript, no extra deps beyond `react`/`react-dom`.
