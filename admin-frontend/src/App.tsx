import React, { useEffect, useState } from 'react';

type SystemConfig = {
  rateLimitPerMinute: number;
  initRateDelayMin: number;
  initRateDelayMax: number;
};

export const App: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    fetch('/api/admin/system-config')
      .then((res) => res.json())
      .then(setConfig)
      .catch(() => {
        setConfig(null);
      });
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Admin Panel · AI Sales Bot</h1>
      <p>Черновой интерфейс для конфигурации и аналитики.</p>

      <section style={{ marginTop: 24 }}>
        <h2>System config (read-only)</h2>
        {config ? (
          <ul>
            <li>RATE_LIMIT_PER_MINUTE: {config.rateLimitPerMinute}</li>
            <li>
              INIT_RATE_DELAY_MIN / MAX: {config.initRateDelayMin} / {config.initRateDelayMax} сек
            </li>
          </ul>
        ) : (
          <p>Не удалось загрузить конфиг или backend не запущен.</p>
        )}
      </section>
    </div>
  );
};

