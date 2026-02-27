import React, { useEffect, useState } from 'react';
import './index.css';

type SystemConfig = {
  rateLimitPerMinute: number;
  initRateDelayMin: number;
  initRateDelayMax: number;
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/system-config')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => {
        setConfig(null);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>AI Sales Bot</h1>
        <span>· Админ-панель</span>
      </header>

      <main className="main">
        <p className="subtitle" style={{ marginBottom: '1rem' }}>
          Конфигурация и аналитика чат-бота
        </p>

        <section className="card">
          <h2>Системный конфиг</h2>
          <p className="subtitle">Текущие настройки (только чтение)</p>
          {loading ? (
            <p className="subtitle">Загрузка…</p>
          ) : config ? (
            <ul className="config-list">
              <li>
                <span className="label">Лимит сообщений в минуту</span>
                <span className="value">{config.rateLimitPerMinute}</span>
              </li>
              <li>
                <span className="label">Задержка инициализации (мин / макс)</span>
                <span className="value">{config.initRateDelayMin} / {config.initRateDelayMax} сек</span>
              </li>
            </ul>
          ) : (
            <p className="error-msg">Не удалось загрузить конфиг или бэкенд не запущен.</p>
          )}
        </section>
      </main>
    </div>
  );
};
