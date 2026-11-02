import React, { useState } from 'react';
import type { RouteConfig } from '../types';
import { X, Send, PlayCircle, Clock } from 'lucide-react';

interface PlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: RouteConfig[];
}

export const PlaygroundModal: React.FC<PlaygroundModalProps> = ({
  isOpen,
  onClose,
  routes,
}) => {
  const activeRoutes = routes.filter((r) => r.enabled);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(activeRoutes[0]?.id || '');
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [path, setPath] = useState('/todos/1');
  const [requestBody, setRequestBody] = useState('{\n  "title": "Test from Fetcher",\n  "completed": false\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    statusText: string;
    durationMs: number;
    headers: Record<string, string>;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentRoute = routes.find((r) => r.id === (selectedRouteId || activeRoutes[0]?.id));

  const handleSend = async () => {
    if (!currentRoute) {
      setError('Нет активного маршрута для тестирования');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const fullUrl = `http://${currentHost}:${currentRoute.port}${path.startsWith('/') ? path : `/${path}`}`;
    const startTime = Date.now();

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'Fetcher-Playground',
        },
      };

      if (method !== 'GET' && requestBody.trim()) {
        options.body = requestBody;
      }

      const res = await fetch(fullUrl, options);
      const durationMs = Date.now() - startTime;

      const headersObj: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headersObj[k] = v;
      });

      let bodyText = '';
      try {
        const json = await res.json();
        bodyText = JSON.stringify(json, null, 2);
      } catch {
        bodyText = await res.text();
      }

      setResult({
        status: res.status,
        statusText: res.statusText,
        durationMs,
        headers: headersObj,
        body: bodyText,
      });
    } catch (err: any) {
      setError(`Ошибка запроса: ${err.message}. Убедитесь, что прокси на порту ${currentRoute.port} запущен.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PlayCircle size={20} color="#38bdf8" />
            <h3>Request Playground (Интерактивный тест прокси)</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Отправьте реальный браузерный <code>fetch</code> запрос через выделенный порт прокси.
            Обратите внимание: запрос выполняется из браузера без каких-либо CORS-блокировок!
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Целевой прокси-маршрут</label>
              <select
                className="form-input"
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (:{r.port})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">HTTP Метод</label>
              <select
                className="form-input"
                value={method}
                onChange={(e: any) => setMethod(e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Путь запроса</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#94a3b8',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                http://{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:{currentRoute?.port || 5001}
              </span>
              <input
                type="text"
                className="form-input code"
                placeholder="/api/users или /todos/1"
                value={path}
                onChange={(e) => setPath(e.target.value)}
              />
              <button
                id="btn-send-playground-request"
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={loading}
                style={{ minWidth: '120px' }}
              >
                {loading ? <Clock size={16} className="spin" /> : <Send size={16} />}
                <span>{loading ? 'Отправка...' : 'Отправить'}</span>
              </button>
            </div>
          </div>

          {method !== 'GET' && (
            <div className="form-group">
              <label className="form-label">Тело запроса (JSON)</label>
              <textarea
                className="form-input code"
                rows={4}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: result.status < 400 ? '#34d399' : '#f43f5e',
                      fontSize: '15px',
                    }}
                  >
                    HTTP {result.status} {result.statusText}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Время ответа: <strong>{result.durationMs}ms</strong>
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                  }}
                >
                  CORS Passed
                </span>
              </div>

              <div>
                <div className="form-label" style={{ marginBottom: '6px' }}>
                  Тело ответа (Response Body)
                </div>
                <div className="json-view" style={{ maxHeight: '200px' }}>
                  {result.body}
                </div>
              </div>

              <div>
                <div className="form-label" style={{ marginBottom: '6px' }}>
                  Полученные заголовки (Headers)
                </div>
                <div className="json-view" style={{ maxHeight: '120px' }}>
                  {JSON.stringify(result.headers, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
