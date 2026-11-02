import React, { useState, useEffect } from 'react';
import type { RouteConfig } from '../types';
import { X, Sparkles, ChevronDown, ChevronUp, Shield } from 'lucide-react';

interface AddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (routeData: Partial<RouteConfig>) => Promise<void>;
  editRoute?: RouteConfig | null;
}

export const AddRouteModal: React.FC<AddRouteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editRoute,
}) => {
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [port, setPort] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CORS Settings
  const [corsEnabled, setCorsEnabled] = useState(true);
  const [corsCredentials, setCorsCredentials] = useState(true);
  const [corsOrigin, setCorsOrigin] = useState('echo');

  // Cookie Settings
  const [cookieEnabled, setCookieEnabled] = useState(true);
  const [stripSecure, setStripSecure] = useState(true);
  const [rewriteDomain, setRewriteDomain] = useState(true);
  const [sameSite, setSameSite] = useState<'lax' | 'none' | 'strict' | 'preserve'>('lax');

  // Change Origin
  const [changeOrigin, setChangeOrigin] = useState(true);

  const fetchNextPort = async () => {
    try {
      const res = await fetch('/api/next-port');
      const data = await res.json();
      if (data.port) {
        setPort(data.port);
      }
    } catch {
      setPort(5001);
    }
  };

  useEffect(() => {
    if (editRoute) {
      setName(editRoute.name);
      setTargetUrl(editRoute.targetUrl);
      setPort(editRoute.port);
      setCorsEnabled(editRoute.cors.enabled);
      setCorsCredentials(editRoute.cors.allowCredentials);
      setCorsOrigin(editRoute.cors.allowOrigin);
      setCookieEnabled(editRoute.cookies.enabled);
      setStripSecure(editRoute.cookies.stripSecure);
      setRewriteDomain(editRoute.cookies.rewriteDomain);
      setSameSite(editRoute.cookies.sameSite);
      setChangeOrigin(editRoute.headers.changeOrigin);
      setError(null);
    } else {
      setName('');
      setTargetUrl('');
      setError(null);
      fetchNextPort();
      setCorsEnabled(true);
      setCorsCredentials(true);
      setCorsOrigin('echo');
      setCookieEnabled(true);
      setStripSecure(true);
      setRewriteDomain(true);
      setSameSite('lax');
      setChangeOrigin(true);
    }
  }, [editRoute, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название бэкенда');
      return;
    }
    if (!targetUrl.trim()) {
      setError('Введите целевой URL бэкенда');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        targetUrl: targetUrl.trim(),
        port: port ? Number(port) : undefined,
        enabled: true,
        cors: {
          enabled: corsEnabled,
          allowCredentials: corsCredentials,
          allowOrigin: corsOrigin,
          allowMethods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
          allowHeaders: '*',
          exposeHeaders: '*',
          maxAge: 86400,
        },
        cookies: {
          enabled: cookieEnabled,
          stripSecure,
          rewriteDomain,
          targetDomain: '',
          sameSite,
        },
        headers: {
          changeOrigin,
          customRequestHeaders: editRoute?.headers.customRequestHeaders || {},
          customResponseHeaders: editRoute?.headers.customResponseHeaders || {},
        },
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editRoute ? 'Редактировать бэкенд' : 'Добавить API бэкенд'}</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  padding: '10px 14px',
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

            <div className="form-group">
              <label className="form-label">Название сервиса</label>
              <input
                id="input-route-name"
                type="text"
                className="form-input"
                placeholder="например: Auth Service, Billing API, Users Microservice"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Целевой URL бэкенда (куда проксировать)</label>
              <input
                id="input-route-target"
                type="text"
                className="form-input code"
                placeholder="http://localhost:8000 или http://backend-container:8080"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
              <span className="form-hint">
                Адрес существующего контейнера, локального сервиса или удаленного API.
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Выделенный порт для фронтенда</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="input-route-port"
                    type="number"
                    className="form-input code"
                    placeholder="5001"
                    value={port}
                    onChange={(e) => setPort(e.target.value ? Number(e.target.value) : '')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={fetchNextPort}
                    title="Найти следующий свободный порт"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Sparkles size={14} />
                    <span>Авто</span>
                  </button>
                </div>
                <span className="form-hint">
                  Фронтенд будет подключаться к <code>http://{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:{port || 5001}</code>
                </span>
              </div>
            </div>

            {/* Toggle Advanced Settings */}
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 14px' }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={15} color="#38bdf8" />
                  <span>Тонкие настройки CORS и Cookie</span>
                </span>
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvanced && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={corsEnabled}
                      onChange={(e) => setCorsEnabled(e.target.checked)}
                    />
                    <div>
                      <div className="checkbox-text">Включить автоматический CORS Resolver</div>
                      <div className="form-hint">
                        Перехватывает preflight OPTIONS запросы и возвращает 204 OK
                      </div>
                    </div>
                  </label>

                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={corsCredentials}
                      onChange={(e) => setCorsCredentials(e.target.checked)}
                    />
                    <div>
                      <div className="checkbox-text">Разрешить Credentials (куки и авторизацию)</div>
                      <div className="form-hint">
                        Добавляет <code>Access-Control-Allow-Credentials: true</code>
                      </div>
                    </div>
                  </label>

                  <label className="checkbox-group">
                    <input
                      type="checkbox"
                      checked={cookieEnabled}
                      onChange={(e) => setCookieEnabled(e.target.checked)}
                    />
                    <div>
                      <div className="checkbox-text">Активировать Cookie Sanitizer</div>
                      <div className="form-hint">
                        Снимает флаг <code>Secure</code> для HTTP и адаптирует <code>Domain</code>
                      </div>
                    </div>
                  </label>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Политика SameSite</label>
                      <select
                        className="form-input"
                        value={sameSite}
                        onChange={(e: any) => setSameSite(e.target.value)}
                      >
                        <option value="lax">Lax (Рекомендуется для dev)</option>
                        <option value="none">None (Для кросс-доменных запросов)</option>
                        <option value="strict">Strict</option>
                        <option value="preserve">Не менять (как у бэкенда)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Origin для заголовков CORS</label>
                      <select
                        className="form-input"
                        value={corsOrigin}
                        onChange={(e) => setCorsOrigin(e.target.value)}
                      >
                        <option value="echo">Echo (Зеркалировать Origin браузера)</option>
                        <option value="*">* (Wildcard)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button
              id="btn-save-route"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Сохранение...' : editRoute ? 'Обновить' : 'Создать прокси'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
