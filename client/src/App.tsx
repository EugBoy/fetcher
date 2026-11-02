import { useState, useEffect, useRef } from 'react';
import type { RouteConfig, RequestLog } from './types';
import { Navbar } from './components/Navbar';
import { MetricsBar } from './components/MetricsBar';
import { RouteCard } from './components/RouteCard';
import { AddRouteModal } from './components/AddRouteModal';
import { TrafficInspector } from './components/TrafficInspector';
import { PlaygroundModal } from './components/PlaygroundModal';
import { Network, Activity, Terminal, Info, CheckCircle2 } from 'lucide-react';

export function App() {
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'routes' | 'inspector'>('routes');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteConfig | null>(null);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  };

  // Fetch initial state
  const loadState = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.routes) {
        setRoutes(data.routes);
      }
    } catch (err) {
      console.error('[Fetcher Client] Error loading config:', err);
    }

    try {
      const res = await fetch('/api/logs?limit=100');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error('[Fetcher Client] Error loading logs:', err);
    }
  };

  // Connect WebSocket
  useEffect(() => {
    loadState();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'INIT') {
            if (payload.data?.config?.routes) {
              setRoutes(payload.data.config.routes);
            }
            if (payload.data?.logs) {
              setLogs(payload.data.logs);
            }
          } else if (payload.type === 'NEW_LOG') {
            setLogs((prev) => [...prev.slice(-299), payload.data]);
          } else if (payload.type === 'STATS_UPDATE') {
            const { routeId, stats } = payload.data;
            setRoutes((prev) =>
              prev.map((r) => (r.id === routeId ? { ...r, stats } : r))
            );
          }
        } catch (e) {
          console.error('[WS Parse Error]:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleToggleRoute = async (id: string) => {
    try {
      const res = await fetch(`/api/routes/${id}/toggle`, { method: 'POST' });
      const updated = await res.json();
      setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast(updated.enabled ? 'Прокси запущен' : 'Прокси приостановлен');
    } catch (err: any) {
      showToast(`Ошибка переключения: ${err.message}`);
    }
  };

  const handleSaveRoute = async (routeData: Partial<RouteConfig>) => {
    if (editingRoute) {
      // Update
      const res = await fetch(`/api/routes/${editingRoute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при обновлении');
      }
      const updated = await res.json();
      setRoutes((prev) => prev.map((r) => (r.id === editingRoute.id ? updated : r)));
      showToast(`Маршрут "${updated.name}" обновлен`);
    } else {
      // Create
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при создании');
      }
      const created = await res.json();
      setRoutes((prev) => [...prev, created]);
      showToast(`Прокси для "${created.name}" запущен на порту ${created.port}!`);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    const route = routes.find((r) => r.id === id);
    if (!window.confirm(`Удалить прокси-маршрут "${route?.name || id}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/routes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRoutes((prev) => prev.filter((r) => r.id !== id));
        showToast('Маршрут успешно удален');
      }
    } catch (err: any) {
      showToast(`Ошибка удаления: ${err.message}`);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      showToast('История запросов очищена');
    } catch (err: any) {
      showToast(`Ошибка: ${err.message}`);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        wsConnected={wsConnected}
        onOpenAddModal={() => {
          setEditingRoute(null);
          setIsAddModalOpen(true);
        }}
        onOpenPlayground={() => setIsPlaygroundOpen(true)}
      />

      <MetricsBar routes={routes} logs={logs} />

      {/* Guide Banner */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Info size={18} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
              Как это работает с Docker и фронтендом?
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Добавьте URL бэкенда (например, <code>http://localhost:8000</code>). Скопируйте выделенный порт (например, <code>http://localhost:5001</code>) в <code>.env</code> фронтенда. Все CORS блокировки и потери Cookie будут устранены автоматически.
            </div>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setIsPlaygroundOpen(true)}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <Terminal size={14} />
          <span>Быстрый тест</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          id="tab-routes"
          className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <Network size={16} />
          <span>Маршруты и прокси</span>
          <span className="tab-badge">{routes.length}</span>
        </button>

        <button
          id="tab-inspector"
          className={`tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          onClick={() => setActiveTab('inspector')}
        >
          <Activity size={16} />
          <span>Инспектор трафика (Live)</span>
          <span className="tab-badge">{logs.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'routes' ? (
        <>
          <div className="routes-grid">
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                onToggle={handleToggleRoute}
                onEdit={(r) => {
                  setEditingRoute(r);
                  setIsAddModalOpen(true);
                }}
                onDelete={handleDeleteRoute}
                onShowToast={showToast}
              />
            ))}
          </div>

          {routes.length === 0 && (
            <div className="empty-state">
              <Network size={48} className="empty-icon" />
              <h3>Нет добавленных бэкендов</h3>
              <p style={{ marginTop: '8px', marginBottom: '16px' }}>
                Добавьте первый сервис, чтобы получить выделенный локальный порт без ошибок CORS.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingRoute(null);
                  setIsAddModalOpen(true);
                }}
              >
                Добавить бэкенд
              </button>
            </div>
          )}
        </>
      ) : (
        <TrafficInspector
          logs={logs}
          routes={routes}
          onClearLogs={handleClearLogs}
        />
      )}

      {/* Modals */}
      <AddRouteModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingRoute(null);
        }}
        onSave={handleSaveRoute}
        editRoute={editingRoute}
      />

      <PlaygroundModal
        isOpen={isPlaygroundOpen}
        onClose={() => setIsPlaygroundOpen(false)}
        routes={routes}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notice">
          <CheckCircle2 size={16} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
