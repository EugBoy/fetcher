import React from 'react';
import type { RouteConfig, RequestLog } from '../types';
import { Activity, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MetricsBarProps {
  routes: RouteConfig[];
  logs: RequestLog[];
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ routes, logs }) => {
  const activeRoutesCount = routes.filter((r) => r.isRunning && r.enabled).length;

  let totalRequests = 0;
  let total2xx = 0;
  let totalErrors = 0;

  for (const r of routes) {
    if (r.stats) {
      totalRequests += r.stats.totalRequests;
      total2xx += r.stats.status2xx;
      totalErrors += r.stats.status4xx + r.stats.status5xx;
    }
  }

  // Also include count from current in-memory logs if stats are 0
  if (totalRequests === 0 && logs.length > 0) {
    totalRequests = logs.length;
    total2xx = logs.filter((l) => l.status >= 200 && l.status < 300).length;
    totalErrors = logs.filter((l) => l.status >= 400).length;
  }

  const corsProtectedRequests = logs.filter((l) => l.corsApplied).length;

  return (
    <div className="metrics-row">
      <div className="metric-card">
        <div
          className="metric-icon-wrapper"
          style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
        >
          <Activity size={22} />
        </div>
        <div className="metric-info">
          <h4>Активные прокси</h4>
          <div className="metric-value">
            {activeRoutesCount} <span style={{ fontSize: '14px', color: '#64748b' }}>/ {routes.length}</span>
          </div>
        </div>
      </div>

      <div className="metric-card">
        <div
          className="metric-icon-wrapper"
          style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}
        >
          <CheckCircle2 size={22} />
        </div>
        <div className="metric-info">
          <h4>Успешных запросов (2xx)</h4>
          <div className="metric-value">{total2xx}</div>
        </div>
      </div>

      <div className="metric-card">
        <div
          className="metric-icon-wrapper"
          style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}
        >
          <ShieldCheck size={22} />
        </div>
        <div className="metric-info">
          <h4>CORS & Cookie Fixes</h4>
          <div className="metric-value">{corsProtectedRequests}</div>
        </div>
      </div>

      <div className="metric-card">
        <div
          className="metric-icon-wrapper"
          style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}
        >
          <AlertTriangle size={22} />
        </div>
        <div className="metric-info">
          <h4>Ошибок бэкендов</h4>
          <div className="metric-value">{totalErrors}</div>
        </div>
      </div>
    </div>
  );
};
