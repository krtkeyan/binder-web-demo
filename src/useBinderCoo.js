import { useEffect, useRef, useState, useCallback } from 'react';
import { BinderCooClient } from './binderCooClient';

// React hook around BinderCooClient.
//   const { state, identity, messages, toolChips, error, send } = useBinderCoo(cfg);
// `cfg` may be null to defer connection until the user provides credentials.
export function useBinderCoo(cfg) {
  const clientRef = useRef(null);
  const [state, setState] = useState('idle');
  const [identity, setIdentity] = useState(null);
  const [messages, setMessages] = useState([]); // { role, text, toolChips? }
  const [error, setError] = useState(null);
  const activeAssistantIdx = useRef(null);

  useEffect(() => {
    if (!cfg) return undefined;
    const coo = new BinderCooClient({ ...cfg, autoReconnect: true });
    clientRef.current = coo;

    coo.on('state', setState);
    coo.on('identity', setIdentity);
    coo.on('error', setError);

    coo.on('delta', (text) => {
      setMessages((prev) => {
        const next = [...prev];
        if (activeAssistantIdx.current === null) {
          next.push({ role: 'assistant', text, toolChips: [] });
          activeAssistantIdx.current = next.length - 1;
        } else {
          next[activeAssistantIdx.current] = { ...next[activeAssistantIdx.current], text };
        }
        return next;
      });
    });

    coo.on('final', (text) => {
      setMessages((prev) => {
        const next = [...prev];
        if (activeAssistantIdx.current === null) {
          next.push({ role: 'assistant', text, toolChips: [] });
        } else {
          next[activeAssistantIdx.current] = { ...next[activeAssistantIdx.current], text };
        }
        return next;
      });
      activeAssistantIdx.current = null;
    });

    coo.on('tool', (e) => {
      setMessages((prev) => {
        const next = [...prev];
        let idx = activeAssistantIdx.current;
        if (idx === null) {
          next.push({ role: 'assistant', text: '', toolChips: [] });
          idx = next.length - 1;
          activeAssistantIdx.current = idx;
        }
        const chips = [...(next[idx].toolChips ?? [])];
        if (e.phase === 'start') {
          chips.push({ id: e.toolCallId, name: e.name, done: false });
        } else {
          const chip = chips.find((c) => c.id === e.toolCallId);
          if (chip) chip.done = true;
        }
        next[idx] = { ...next[idx], toolChips: chips };
        return next;
      });
    });

    coo.connect();

    return () => coo.close();
  }, [cfg?.gatewayUrl, cfg?.authToken, cfg?.userId]); // reconnect when creds change

  const send = useCallback((text) => {
    if (!clientRef.current) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    try { clientRef.current.send(text); }
    catch (err) { setError({ code: 'send-failed', message: err.message }); }
  }, []);

  return { state, identity, messages, error, send };
}
