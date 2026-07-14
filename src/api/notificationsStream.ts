import { openEventStream } from './client';

const RECONNECT_DELAY_MS = 2_000;

function dispatchEvents(chunk: string, onNotification: () => void): string {
  const normalized = chunk.replaceAll('\r\n', '\n');
  const blocks = normalized.split('\n\n');
  const remainder = blocks.pop() ?? '';
  for (const block of blocks) {
    const lines = block.split('\n');
    const event = lines
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim();
    if (event === 'notification') onNotification();
  }
  return remainder;
}

/** Авторизованная SSE-подписка с автоматическим переподключением. */
export function subscribeToNotifications(onNotification: () => void): () => void {
  let stopped = false;
  let controller = new AbortController();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = async () => {
    controller = new AbortController();
    try {
      const response = await openEventStream('/notifications/stream', controller.signal);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Браузер не поддерживает потоковые ответы');
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = dispatchEvents(buffer, onNotification);
      }
    } catch (error) {
      if (!stopped && !(error instanceof DOMException && error.name === 'AbortError')) {
        // Временный сетевой сбой обрабатывается переподключением ниже.
      }
    }
    if (!stopped) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  };

  void connect();
  return () => {
    stopped = true;
    controller.abort();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}
