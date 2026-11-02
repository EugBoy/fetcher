import React from 'react';
import { Zap, Plus, PlayCircle, Radio } from 'lucide-react';

interface NavbarProps {
  wsConnected: boolean;
  onOpenAddModal: () => void;
  onOpenPlayground: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  wsConnected,
  onOpenAddModal,
  onOpenPlayground,
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="logo-badge">
          <Zap size={26} />
        </div>
        <div>
          <div className="brand-title">
            Fetcher
            <span className="brand-badge">Dev Gateway</span>
          </div>
          <div className="brand-subtitle">
            CORS & Cookie Resolver для мультиконтейнерной разработки
          </div>
        </div>
      </div>

      <div className="header-actions">
        <div
          title={wsConnected ? 'Real-time WebSocket подключен' : 'Переподключение к WebSocket...'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '9999px',
            background: wsConnected ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 191, 36, 0.1)',
            border: `1px solid ${wsConnected ? 'rgba(52, 211, 153, 0.25)' : 'rgba(251, 191, 36, 0.25)'}`,
            fontSize: '12px',
            color: wsConnected ? '#34d399' : '#fbbf24',
          }}
        >
          <Radio size={14} className={wsConnected ? '' : 'spin'} />
          <span>{wsConnected ? 'Live Feed' : 'Connecting...'}</span>
        </div>

        <button
          id="btn-open-playground"
          className="btn btn-secondary"
          onClick={onOpenPlayground}
          title="Открыть интерактивную консоль тестирования запросов"
        >
          <PlayCircle size={16} />
          <span>Playground</span>
        </button>

        <button
          id="btn-add-backend"
          className="btn btn-primary"
          onClick={onOpenAddModal}
        >
          <Plus size={16} />
          <span>Добавить бэкенд</span>
        </button>
      </div>
    </header>
  );
};
