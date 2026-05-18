# Binder COO — React Web Chat (v2.0)

React + Vite client that talks to the Binder COO chat proxy over WebSocket. Follows
the v2.0 wire protocol from `Binder-Web-integration.pdf`.

Same agent, same prompts, same tools the Telegram bot uses — different transport.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL. The connect dialog is **prefilled with the public staging
credentials** from the integration doc — just click **Connect**.

| Value         | Example (staging)                                            |
|---------------|--------------------------------------------------------------|
| `gatewayUrl`  | `wss://binder-coo.tail2db2f3.ts.net/`                        |
| `authToken`   | `33695de1ddd1969234f8e65f977858d3d3c095068c667d1a`           |
| `userId`      | `69ab5277-cd49-4677-a7e6-9c5687f60417`                       |

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
