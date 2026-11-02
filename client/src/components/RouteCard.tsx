import React, { useState } from 'react';
import type { RouteConfig } from '../types';
import {
  Copy,
  Check,
  Power,
  Edit2,
  Trash2,
  ExternalLink,
  Shield,
  Cookie,
  Radio,
  Zap,
} from 'lucide-react';

interface RouteCardProps {
  route: RouteConfig;
  onToggle: (id: string) => void;
  onEdit: (route: RouteConfig) => void;
  onDelete: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  onToggle,
  onEdit,
  onDelete,
  onShowToast,
}) => {
  const [copiedPort, setCopiedPort] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{ reachable: boolean; durationMs?: number; status?: number; error?: string } | null>(null);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const proxyUrl = `http://${currentHost}:${route.port}`;
  const envSnippet = `VITE_API_URL=${proxyUrl}`;

  const copyToClipboard = (text: string, type: 'port' | 'env') => {
    navigator.clipboard.writeText(text);
    if (type === 'port') {
      setCopiedPort(true);
      setTimeout(() => setCopiedPort(false), 2000);
      onShowToast(`Скопирован адрес: ${text}`);
    } else {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
      onShowToast(`Скопирован .env сниппет: ${text}`);
    }
  };

  const handleTestPing = async () => {
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: route.targetUrl }),
      });
      const data = await res.json();
      setPingResult(data);
      if (data.reachable) {
        onShowToast(`Бэкенд доступен: HTTP ${data.status} (${data.durationMs}ms)`);
      } else {
        onShowToast(`Бэкенд недоступен: ${data.error}`);
      }
    } catch (err: any) {
      setPingResult({ reachable: false, error: err.message });
    } finally {
      setPingLoading(false);
    }
  };

  const handleClearCookies = async () => {
    try {
      await fetch(`/api/routes/${route.id}/clear-cookies`, { method: 'POST' });
      onShowToast(`Сессионные куки для "${route.name}" сброшены`);
    } catch {
      onShowToast('Ошибка сброса кук');
    }
  };

  const isRunning = route.isRunning ?? route.enabled;

  return (
    <div className={`route-card ${!isRunning ? 'stopped' : ''}`} id={`route-card-${route.id}`}>
      <div className="route-card-header">
        <div className="route-title-area">
          <div className={`status-indicator ${isRunning ? 'active' : 'stopped'}`} />
          <div>
            <h3 className="route-name">{route.name}</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {isRunning ? 'Прокси слушает трафик' : 'Прокси остановлен'}
            </span>
          </div>
        </div>

        <div className="route-card-actions">
          <button
            className="btn-icon"
            onClick={handleClearCookies}
            title="Сбросить сохранённые cookies/сессию в Cookie Jar"
          >
            <Cookie size={15} color="#818cf8" />
          </button>

          <button
            className="btn-icon"
            onClick={handleTestPing}
            disabled={pingLoading}
            title="Проверить доступность целевого бэкенда"
          >
            <Zap size={15} color={pingResult?.reachable ? '#34d399' : '#94a3b8'} />
          </button>

          <button
            className="btn-icon"
            onClick={() => onToggle(route.id)}
            title={isRunning ? 'Приостановить прокси' : 'Запустить прокси'}
            style={{ color: isRunning ? '#34d399' : '#94a3b8' }}
          >
            <Power size={15} />
          </button>

          <button
            className="btn-icon"
            onClick={() => onEdit(route)}
            title="Редактировать настройки"
          >
            <Edit2 size={15} />
          </button>

          <button
            className="btn-icon"
            onClick={() => onDelete(route.id)}
            title="Удалить маршрут"
            style={{ color: '#f43f5e' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Target Backend Endpoint */}
      <div className="endpoint-box">
        <div className="endpoint-label">
          <span>Целевой бэкенд</span>
          <a
            href={route.targetUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span>открыть</span>
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="endpoint-value-row">
          <span className="endpoint-url target">{route.targetUrl}</span>
          {pingResult && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: pingResult.reachable ? '#34d399' : '#f43f5e',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {pingResult.reachable ? `${pingResult.durationMs}ms` : 'FAIL'}
            </span>
          )}
        </div>
      </div>

      {/* Allocated Local Proxy Port */}
      <div className="endpoint-box" style={{ borderColor: 'rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.05)' }}>
        <div className="endpoint-label" style={{ color: '#38bdf8' }}>
          <span>Локальный прокси-порт (подключайте фронтенд сюда)</span>
          <button
            className="copy-badge-btn"
            onClick={() => copyToClipboard(envSnippet, 'env')}
            title="Скопировать VITE_API_URL=http://localhost:..."
          >
            {copiedEnv ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
            <span>{copiedEnv ? 'Скопировано!' : 'Скопировать .env'}</span>
          </button>
        </div>
        <div className="endpoint-value-row">
          <a
            href={proxyUrl}
            target="_blank"
            rel="noreferrer"
            className="endpoint-url"
            style={{ fontSize: '14px', fontWeight: 600 }}
          >
            {proxyUrl}
          </a>
          <button
            className="copy-badge-btn"
            onClick={() => copyToClipboard(proxyUrl, 'port')}
            title="Скопировать URL прокси"
          >
            {copiedPort ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            <span>{copiedPort ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>

      {/* Feature Badges */}
      <div className="features-tags">
        {route.cors.enabled && (
          <span className="feature-tag highlight" title="Автоматическое подавление CORS и preflight OPTIONS">
            <Shield size={12} />
            <span>CORS Bypass ({route.cors.allowOrigin})</span>
          </span>
        )}
        {route.cookies.enabled && (
          <span className="feature-tag cookie" title="Очистка Secure и перезапись Domain в Set-Cookie">
            <Cookie size={12} />
            <span>Cookie Sanitizer ({route.cookies.sameSite})</span>
          </span>
        )}
        <span className="feature-tag" title="Поддержка сквозного проксирования WebSocket">
          <Radio size={12} />
          <span>WebSocket</span>
        </span>
      </div>

      {/* Route Footer with Stats */}
      <div className="route-footer">
        <div className="stat-pills">
          <span className="stat-pill success">
            2xx: {route.stats?.status2xx || 0}
          </span>
          <span className="stat-pill error">
            Errors: {(route.stats?.status4xx || 0) + (route.stats?.status5xx || 0)}
          </span>
        </div>
        <div>
          Всего запросов: <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{route.stats?.totalRequests || 0}</strong>
        </div>
      </div>
    </div>
  );
};
