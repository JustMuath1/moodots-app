import { useEffect, useRef, useCallback, useState } from 'react';
import { REMOTE, socketUrl, attachSocket, detachSocket, takeReply, setLink } from '../utils/remote';

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const [readyState, setReadyState] = useState(WebSocket.CLOSED);
  const reconnectTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(socketUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setReadyState(WebSocket.OPEN);
      if (REMOTE) { attachSocket(ws); setLink('up'); }
    };
    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED);
      if (REMOTE) { detachSocket(ws); setLink('down'); }
      reconnectTimer.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (REMOTE && takeReply(msg)) return;
        onMessageRef.current?.(msg);
      } catch {}
    };
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) { ws.onclose = null; if (REMOTE) { detachSocket(ws); } ws.close(); }
    };
  }, [connect]);

  return { send, readyState, reconnect: connect };
}
