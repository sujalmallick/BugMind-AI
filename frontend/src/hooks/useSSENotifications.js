import { useEffect, useRef, useCallback } from "react";

/**
 * useSSENotifications
 *
 * Opens a Server-Sent Events connection to /api/notifications/stream.
 *
 * SECURITY NOTE — JWT in query param:
 *   The browser's native EventSource API cannot send custom headers, so the
 *   JWT must be passed as a query parameter. This means it may appear in
 *   server and proxy logs.
 *   TODO: Migrate to cookie-based auth or a fetch()-based SSE client
 *   (e.g. @microsoft/fetch-event-source) to eliminate this exposure.
 *
 * @param {object} options
 * @param {function} options.onSignal  - Called with the parsed signal payload
 *                                       e.g. { event: "new_notification", unread_count: 3 }
 * @param {boolean}  options.enabled   - Set false to skip connecting (e.g. logged-out)
 */
import api from "../services/api";

export function useSSENotifications({ onSignal, enabled = true }) {
  const esRef = useRef(null);
  const onSignalRef = useRef(onSignal);

  // Keep ref current without re-opening the connection on every render
  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  const connect = useCallback(() => {
    if (!enabled) return;

    const token = localStorage.getItem("bugmind_token");
    if (!token) return;

    const baseUrl = api.defaults.baseURL || "http://127.0.0.1:8000";
    const url = `${baseUrl}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Ignore the initial "connected" handshake
        if (data.event === "connected") return;
        onSignalRef.current?.(data);
      } catch {
        // Malformed JSON — ignore
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error; we just clean up the stale ref
      // and let the browser reopen the connection.
      es.close();
      esRef.current = null;
      // Re-attempt after a short delay to avoid rapid reconnect storms
      setTimeout(connect, 3000);
    };
  }, [enabled]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);
}
