import React, { useState } from 'react';
import type { RequestLog, RouteConfig } from '../types';
import {
  Search,
  Trash2,
  X,
  Clock,
  Shield,
  Cookie,
  ArrowRight,
} from 'lucide-react';

interface TrafficInspectorProps {
  logs: RequestLog[];
  routes: RouteConfig[];
  onClearLogs: () => void;
}

export const TrafficInspector: React.FC<TrafficInspectorProps> = ({
  logs,
  routes,
  onClearLogs,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (selectedRouteId !== 'all' && log.routeId !== selectedRouteId) {
      return false;
    }
    if (statusFilter === '2xx' && (log.status < 200 || log.status >= 300)) return false;
    if (statusFilter === '3xx' && (log.status < 300 || log.status >= 400)) return false;
    if (statusFilter === '4xx' && (log.status < 400 || log.status >= 500)) return false;
    if (statusFilter === '5xx' && log.status < 500) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.url.toLowerCase().includes(q) ||
        log.method.toLowerCase().includes(q) ||
        log.routeName.toLowerCase().includes(q) ||
        String(log.status).includes(q)
      );
    }
    return true;
  });

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 's2xx';
    if (status >= 300 && status < 400) return 's3xx';
    if (status >= 400 && status < 500) return 's4xx';
    return 's5xx';
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title">
          <div className="live-dot" />
          <span>Live Traffic Inspector</span>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>
            ({filteredLogs.length} событий)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '11px', color: '#64748b' }}
            />
            <input
              id="input-search-logs"
              type="text"
              className="form-input"
              placeholder="Поиск по URL, методу..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '12px' }}
            />
          </div>

          {/* Route filter */}
          <select
            className="form-input"
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            style={{ width: '160px', fontSize: '12px' }}
          >
            <option value="all">Все бэкенды</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '110px', fontSize: '12px' }}
          >
            <option value="all">Все статусы</option>
            <option value="2xx">2xx OK</option>
            <option value="3xx">3xx Redir</option>
            <option value="4xx">4xx Client</option>
            <option value="5xx">5xx Error</option>
          </select>

          {/* Clear logs */}
          <button
            id="btn-clear-logs"
            className="btn btn-secondary"
            onClick={onClearLogs}
            title="Очистить историю запросов"
            style={{ padding: '7px 12px' }}
          >
            <Trash2 size={14} />
            <span>Очистить</span>
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <Clock size={40} className="empty-icon" />
            <p>Пока нет перехваченных запросов</p>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Отправьте любой запрос через выделенный порт или используйте вкладку Playground.
            </span>
          </div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Метод</th>
                <th style={{ width: '80px' }}>Статус</th>
                <th>Путь / URL</th>
                <th style={{ width: '180px' }}>Бэкенд</th>
                <th style={{ width: '120px' }}>Защита</th>
                <th style={{ width: '90px' }}>Время</th>
                <th style={{ width: '90px' }}>Ответ</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice().reverse().map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  title="Нажмите для просмотра детальной информации"
                >
                  <td>
                    <span className={`method-tag ${log.method}`}>{log.method}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    <div style={{ wordBreak: 'break-all' }}>{log.url}</div>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '12px' }}>{log.routeName}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {log.corsApplied && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Shield size={10} />
                          CORS
                        </span>
                      )}
                      {log.cookiesModified && (
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 5px',
                            borderRadius: '4px',
                            background: 'rgba(129, 140, 248, 0.15)',
                            color: '#818cf8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Cookie size={10} />
                          Cookie
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#94a3b8' }}>
                    {log.durationMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div
            className="modal-content log-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className={`method-tag ${selectedLog.method}`}>{selectedLog.method}</span>
                <span className={`status-badge ${getStatusClass(selectedLog.status)}`}>
                  HTTP {selectedLog.status}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {selectedLog.routeName}
                </span>
              </div>
              <button className="btn-icon" onClick={() => setSelectedLog(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Path Routing Info */}
              <div className="endpoint-box">
                <div className="endpoint-label">Маршрутизация запроса</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                    {selectedLog.url}
                  </span>
                  <ArrowRight size={14} color="#64748b" />
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>
                    {selectedLog.targetUrl}
                  </span>
                </div>
              </div>

              {/* Injected Protections */}
              {(selectedLog.corsApplied || selectedLog.cookiesModified) && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                    ✨ Автоматические модификации Fetcher:
                  </div>
                  {selectedLog.corsApplied && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      • <strong>CORS:</strong> Внедрены разрешающие заголовки <code>Access-Control-Allow-Origin: {selectedLog.requestHeaders?.origin || '*'}</code> и <code>Credentials: true</code>.
                    </div>
                  )}
                  {selectedLog.cookiesModified && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      • <strong>Cookies:</strong> Снят флаг <code>Secure</code> и нормализован <code>Domain</code> в <code>Set-Cookie</code>.
                    </div>
                  )}
                </div>
              )}

              {/* Error box if any */}
              {selectedLog.error && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(244, 63, 94, 0.15)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    color: '#f43f5e',
                    fontSize: '12px',
                  }}
                >
                  <strong>Ошибка соединения:</strong> {selectedLog.error}
                </div>
              )}

              {/* Response Headers */}
              <div>
                <div className="form-label" style={{ marginBottom: '6px' }}>
                  Заголовки ответа (Response Headers)
                </div>
                <div className="json-view">
                  {JSON.stringify(selectedLog.responseHeaders, null, 2)}
                </div>
              </div>

              {/* Request Headers */}
              <div>
                <div className="form-label" style={{ marginBottom: '6px' }}>
                  Заголовки запроса (Request Headers)
                </div>
                <div className="json-view">
                  {JSON.stringify(selectedLog.requestHeaders, null, 2)}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLog(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
