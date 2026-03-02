import React, { useEffect, useState } from 'react';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary';

type Tab = 'dashboard' | 'config' | 'managers' | 'stoplist' | 'sessions' | 'knowledge' | 'prompts' | 'followup' | 'test';

type SystemConfig = {
  rateLimitPerMinute: number;
  initRateDelayMin: number;
  initRateDelayMax: number;
};

type Manager = {
  id: number;
  amoUserId: string | number;
  name: string;
  telegramId: number | null;
  whatsappPhone: string | null;
  active: boolean;
  excludeFromRotation: boolean;
  weight: number;
};

type StopListEntry = {
  id: number;
  phone: string;
  reason: string;
  createdAt: string;
};

type LeadSession = {
  id: string;
  phone: string;
  phoneMasked: string | null;
  status: string;
  amoDealId: string;
  createdAt: string;
  assignedManagerId: number | null;
  handoffAt: string | null;
};

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });

function formatDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('ru');
  } catch {
    return '—';
  }
}

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="app">
      <header className="header">
        <h1>AI Sales Bot</h1>
        <span>· Админ-панель</span>
      </header>

      <main className="main">
        <nav className="tabs">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Дашборд</button>
          <button className={tab === 'config' ? 'active' : ''} onClick={() => setTab('config')}>Конфиг</button>
          <button className={tab === 'managers' ? 'active' : ''} onClick={() => setTab('managers')}>Менеджеры</button>
          <button className={tab === 'stoplist' ? 'active' : ''} onClick={() => setTab('stoplist')}>Стоп-лист</button>
          <button className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>Сессии</button>
          <button className={tab === 'knowledge' ? 'active' : ''} onClick={() => setTab('knowledge')}>База знаний</button>
          <button className={tab === 'prompts' ? 'active' : ''} onClick={() => setTab('prompts')}>Промпты</button>
          <button className={tab === 'followup' ? 'active' : ''} onClick={() => setTab('followup')}>Follow-up</button>
          <button className={tab === 'test' ? 'active' : ''} onClick={() => setTab('test')}>Тестирование бота</button>
        </nav>

        <div className="tab-content" style={{ minHeight: 200 }}>
          {tab === 'dashboard' && <ErrorBoundary><DashboardSection /></ErrorBoundary>}
          {tab === 'config' && <ErrorBoundary><ConfigSection /></ErrorBoundary>}
          {tab === 'managers' && <ErrorBoundary><ManagersSection /></ErrorBoundary>}
          {tab === 'stoplist' && <ErrorBoundary><StopListSection /></ErrorBoundary>}
          {tab === 'sessions' && <ErrorBoundary><SessionsSection /></ErrorBoundary>}
          {tab === 'knowledge' && <ErrorBoundary><KnowledgeSection /></ErrorBoundary>}
          {tab === 'prompts' && <ErrorBoundary><PromptsSection /></ErrorBoundary>}
          {tab === 'followup' && <ErrorBoundary><FollowupTemplatesSection /></ErrorBoundary>}
          {tab === 'test' && <ErrorBoundary><TestSection /></ErrorBoundary>}
        </div>
      </main>
    </div>
  );
};

type DashboardStats = {
  sessionsByStatus: Record<string, number>;
  totalSessions: number;
  messagesToday: number;
  handoffsCount: number;
  stopListCount: number;
  managersCount: number;
  pendingOffHours: number;
};

function DashboardSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    api('dashboard')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => { setStats(null); setError('Не удалось загрузить дашборд'); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Загрузка…</p>;
  if (error || !stats) return <p>{error ?? 'Нет данных'}</p>;

  const sessionsByStatus = stats.sessionsByStatus && typeof stats.sessionsByStatus === 'object' ? stats.sessionsByStatus : {};
  const statusLabels: Record<string, string> = {
    PENDING_INIT: 'Ожидание init',
    INIT_SENT: 'Init отправлен',
    ENGAGED: 'В диалоге',
    QUALIFYING: 'Квалификация',
    PRESENTING: 'Презентация',
    SCHEDULING_ZOOM: 'Запись на Zoom',
    ZOOM_BOOKED: 'Zoom забронирован',
    FOLLOWUP_1: 'Follow-up 1',
    FOLLOWUP_2: 'Follow-up 2',
    FOLLOWUP_3: 'Follow-up 3',
    HANDOFF_TO_HUMAN: 'Передано менеджеру',
    INIT_FAILED: 'Init ошибка',
    CLOSED: 'Закрыто',
  };

  return (
    <section className="dashboard-section">
      <h2>Сводка</h2>
      <div className="dashboard-stat-cards">
        <div className="dashboard-stat-card">
          <span className="label">Всего сессий</span>
          <span className="value">{stats.totalSessions}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="label">Сообщений сегодня</span>
          <span className="value">{stats.messagesToday}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="label">Эскалаций</span>
          <span className="value">{stats.handoffsCount}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="label">Стоп-лист</span>
          <span className="value">{stats.stopListCount}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="label">Активных менеджеров</span>
          <span className="value">{stats.managersCount}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="label">В очереди off-hours</span>
          <span className="value">{stats.pendingOffHours}</span>
        </div>
      </div>
      <div className="dashboard-status-block">
        <h3>Сессии по статусам</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Количество</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sessionsByStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <tr key={status}>
                  <td>{statusLabels[status] ?? status}</td>
                  <td>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConfigSection() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });
  const load = () => {
    setError(null);
    fetch('/api/admin/system-config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => { setConfig(null); setError('Не удалось загрузить конфиг'); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addKey = (e: React.FormEvent) => {
    e.preventDefault();
    const key = form.key.trim();
    if (!key) return;
    const value = form.value.trim() === '' ? null : (() => { try { return JSON.parse(form.value); } catch { return form.value; } })();
    api('system-config', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowForm(false); setForm({ key: '', value: '' }); })
      .catch(() => setError('Ошибка сохранения'));
  };

  const removeKey = (key: string) => {
    if (!confirm(`Удалить параметр "${key}"?`)) return;
    api(`system-config/${encodeURIComponent(key)}`, { method: 'DELETE' })
      .then((r) => r.ok && load());
  };

  const entries = config && typeof config === 'object' ? Object.entries(config) : [];
  return (
    <section className="card">
      <h2>Системный конфиг</h2>
      <p className="subtitle">Ключи и значения (добавление и удаление)</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ключ</th><th>Значение</th><th></th></tr>
              </thead>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => removeKey(k)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showForm ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>Добавить параметр</button>
          ) : (
            <form onSubmit={addKey} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row">
                <label>Ключ</label>
                <input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="rateLimitPerMinute" required />
              </div>
              <div className="form-row">
                <label>Значение (число, строка или JSON)</label>
                <input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="15 или &quot;09:00&quot;" />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Добавить</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function ManagersSection() {
  const [list, setList] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amoUserId: '', name: '', whatsappPhone: '', active: true });
  const load = () => {
    setError(null);
    api('managers')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => { setList([]); setError('Не удалось загрузить список'); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const amoUserId = parseInt(form.amoUserId, 10);
    if (!form.name || isNaN(amoUserId)) return;
    api('managers', {
      method: 'POST',
      body: JSON.stringify({
        amoUserId,
        name: form.name,
        whatsappPhone: form.whatsappPhone || undefined,
        active: form.active,
      }),
    })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowForm(false); setForm({ amoUserId: '', name: '', whatsappPhone: '', active: true }); })
      .catch(() => {});
  };

  const remove = (id: number) => {
    if (!confirm('Удалить менеджера?')) return;
    api(`managers/${id}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  const safeList: Manager[] = Array.isArray(list) ? list : [];
  return (
    <section className="card">
      <h2>Менеджеры</h2>
      <p className="subtitle">Ротация при эскалации</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID amoCRM</th>
                  <th>Имя</th>
                  <th>WhatsApp</th>
                  <th>Активен</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {safeList.map((m, i) => (
                  <tr key={m?.id != null ? m.id : `m-${i}`}>
                    <td>{m ? String(m.amoUserId ?? '') : '—'}</td>
                    <td>{m?.name ?? '—'}</td>
                    <td>{m?.whatsappPhone || '—'}</td>
                    <td>{m?.active ? <span className="badge badge-success">да</span> : <span className="badge badge-muted">нет</span>}</td>
                    <td>
                      {m?.id != null && (
                        <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(m.id)}>Удалить</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showForm ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>Добавить менеджера</button>
          ) : (
            <form onSubmit={create} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row">
                <label>ID пользователя amoCRM</label>
                <input value={form.amoUserId} onChange={(e) => setForm((f) => ({ ...f, amoUserId: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>Имя</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="form-row">
                <label>WhatsApp (необязательно)</label>
                <input value={form.whatsappPhone} onChange={(e) => setForm((f) => ({ ...f, whatsappPhone: e.target.value }))} placeholder="+7..." />
              </div>
              <div className="form-row">
                <label><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Активен</label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Сохранить</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Отмена</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function StopListSection() {
  const [list, setList] = useState<StopListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const load = () => {
    setError(null);
    api('stop-list')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => { setList([]); setError('Не удалось загрузить стоп-лист'); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    api('stop-list', {
      method: 'POST',
      body: JSON.stringify({ phone: phone.trim(), reason: reason.trim() || 'Добавлено вручную' }),
    })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setPhone(''); setReason(''); })
      .catch(() => {});
  };

  const remove = (p: string) => {
    if (!confirm('Удалить номер из стоп-листа?')) return;
    api(`stop-list/${encodeURIComponent(p)}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  const safeList = Array.isArray(list) ? list : [];
  return (
    <section className="card">
      <h2>Стоп-лист</h2>
      <p className="subtitle">Номера, на которые не отправляем сообщения</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <form onSubmit={add} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+77001234567" required />
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <label>Причина</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Необязательно" />
            </div>
            <button type="submit" className="btn btn-primary">Добавить</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Телефон</th><th>Причина</th><th></th></tr>
              </thead>
              <tbody>
                {safeList.map((e, i) => (
                  <tr key={e?.phone ?? e?.id ?? `e-${i}`}>
                    <td>{e?.phone ?? '—'}</td>
                    <td>{e?.reason ?? '—'}</td>
                    <td>
                      {e?.phone && (
                        <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(e.phone)}>Удалить</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SessionsSection() {
  const [list, setList] = useState<LeadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const load = () => {
    setError(null);
    api('lead-sessions')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => { setList([]); setError('Не удалось загрузить сессии'); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handoff = (id: string) => {
    setHandoffId(id);
    api(`lead-sessions/${id}/handoff`, { method: 'POST', body: '{}' })
      .then((r) => r.ok ? load() : Promise.reject())
      .finally(() => setHandoffId(null));
  };

  const removeSession = (id: string) => {
    if (!confirm('Удалить сессию и все сообщения?')) return;
    api(`lead-sessions/${id}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  const [showAddSession, setShowAddSession] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const addSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;
    api('lead-sessions', {
      method: 'POST',
      body: JSON.stringify({ phone: newPhone.trim() }),
    })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowAddSession(false); setNewPhone(''); })
      .catch(() => {});
  };

  const safeList = Array.isArray(list) ? list : [];
  return (
    <section className="card">
      <h2>Сессии лидов</h2>
      <p className="subtitle">Последние диалоги (до 50). Управление: добавить или удалить.</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Телефон</th>
                  <th>Статус</th>
                  <th>Создана</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {safeList.map((s, i) => (
                  <tr key={s?.id ?? `s-${i}`}>
                    <td>{s?.phoneMasked || s?.phone || '—'}</td>
                    <td><span className="badge badge-muted">{s?.status ?? '—'}</span></td>
                    <td>{formatDate(s?.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s?.id && s?.status !== 'HANDOFF_TO_HUMAN' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={handoffId === s.id}
                          onClick={() => handoff(s.id)}
                        >
                          {handoffId === s.id ? '…' : 'Эскалация'}
                        </button>
                      )}
                      {s?.id && (
                        <button type="button" className="btn btn-ghost btn-sm btn-danger" style={{ marginLeft: '0.25rem' }} onClick={() => removeSession(s.id)}>Удалить</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAddSession ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAddSession(true)}>Добавить сессию</button>
          ) : (
            <form onSubmit={addSession} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row">
                <label>Телефон</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+77001234567" required />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">Добавить</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddSession(false)}>Отмена</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function KnowledgeSection() {
  const [docs, setDocs] = useState<{ id: string; filename: string; indexingStatus: string; fragmentCount: number; uploadedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ filename: '', content: '' });
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<{ query: string; results: { content: string; score: number }[] } | null>(null);
  const [viewDoc, setViewDoc] = useState<{ filename: string; content: string | null } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const load = () => {
    setError(null);
    api('knowledge/documents')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: any) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => setError('Не удалось загрузить документы'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.filename.trim()) return;
    api('knowledge/documents', {
      method: 'POST',
      body: JSON.stringify({ filename: form.filename.trim(), fileType: 'md', content: form.content.trim() || undefined }),
    })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowAdd(false); setForm({ filename: '', content: '' }); })
      .catch(() => {});
  };

  const reindex = (id: string) => {
    api(`knowledge/documents/${id}/reindex`, { method: 'POST' })
      .then((r) => r.ok ? load() : Promise.reject())
      .catch(() => {});
  };

  const removeDoc = (id: string) => {
    if (!confirm('Удалить документ и все фрагменты?')) return;
    api(`knowledge/documents/${id}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  const viewDocument = (id: string) => {
    setViewLoading(true);
    setViewDoc(null);
    api(`knowledge/documents/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { filename: string; content?: string | null }) => setViewDoc({ filename: d.filename, content: d.content ?? null }))
      .catch(() => setViewDoc({ filename: '', content: null }))
      .finally(() => setViewLoading(false));
  };

  const runTestRag = (e: React.FormEvent) => {
    e.preventDefault();
    const q = testQuery.trim() || 'тест';
    api('knowledge/test-rag', { method: 'POST', body: JSON.stringify({ query: q }) })
      .then((r) => r.json())
      .then(setTestResults)
      .catch(() => setTestResults(null));
  };

  return (
    <section className="card">
      <h2>База знаний</h2>
      <p className="subtitle">Загрузка документов, индексирование в фрагменты, тест RAG.</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Файл</th><th>Статус</th><th>Фрагментов</th><th>Загружен</th><th></th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{d.filename}</td>
                    <td><span className="badge badge-muted">{d.indexingStatus}</span></td>
                    <td>{d.fragmentCount ?? 0}</td>
                    <td>{formatDate(d.uploadedAt)}</td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => viewDocument(d.id)} style={{ marginRight: '0.5rem' }}>Просмотр</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => reindex(d.id)}>Переиндексировать</button>
                      <button type="button" className="btn btn-ghost btn-sm btn-danger" style={{ marginLeft: '0.25rem' }} onClick={() => removeDoc(d.id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAdd ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}>Добавить документ</button>
          ) : (
            <form onSubmit={addDoc} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row"><label>Имя документа</label><input value={form.filename} onChange={(e) => setForm((f) => ({ ...f, filename: e.target.value }))} placeholder="faq.md" required /></div>
              <div className="form-row"><label>Текст (или вставка)</label><textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Текст для разбиения на фрагменты…" rows={6} style={{ width: '100%' }} /></div>
              <div className="form-actions"><button type="submit" className="btn btn-primary">Добавить и проиндексировать</button><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Отмена</button></div>
            </form>
          )}
          {viewLoading && <p className="subtitle">Загрузка документа…</p>}
          {viewDoc !== null && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setViewDoc(null)}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, maxWidth: 720, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{viewDoc.filename || 'Документ'}</strong>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewDoc(null)}>Закрыть</button>
                </div>
                <div style={{ padding: '1rem 1.25rem', overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {viewDoc.content ?? '(Текст не сохранён или пуст)'}
                </div>
              </div>
            </div>
          )}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>Тест RAG</h3>
            <form onSubmit={runTestRag} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-row" style={{ marginBottom: 0 }}><label>Запрос</label><input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Вопрос для поиска по базе" style={{ minWidth: 200 }} /></div>
              <button type="submit" className="btn btn-primary">Искать</button>
            </form>
            {testResults && (
              <div style={{ marginTop: '0.75rem' }}>
                <p className="subtitle">Результаты по запросу «{testResults.query}»:</p>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>{testResults.results?.slice(0, 5).map((r, i) => <li key={i}>{r.content?.slice(0, 150)}{r.content && r.content.length > 150 ? '…' : ''} (score: {r.score})</li>) ?? []}</ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const DEFAULT_BOT_PROMPT = `Ты — продавец отдела продаж. Цель: записать клиента на Zoom-встречу. Отвечай коротко, не более 400 символов. Один вопрос за раз. Не упоминай слова "бот", "ИИ", "автоматический". Текущий этап: {{currentStep}}.`;

function PromptsSection() {
  const [groups, setGroups] = useState<{ key: string; versions: { id: number; version: number; isActive: boolean; isAbTest: boolean; abTrafficPercent: number | null; content: string; createdAt: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ key: 'dialog_system', content: DEFAULT_BOT_PROMPT });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [viewPrompt, setViewPrompt] = useState<{ key: string; content: string } | null>(null);
  const load = () => {
    setError(null);
    api('prompts')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGroups)
      .catch(() => setError('Не удалось загрузить промпты'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key.trim()) return;
    api('prompts', { method: 'POST', body: JSON.stringify({ key: form.key.trim(), content: form.content }) })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowAdd(false); setForm({ key: '', content: '' }); })
      .catch(() => {});
  };

  const setActive = (id: number, isActive: boolean) => {
    api(`prompts/${id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }).then((r) => r.ok && load());
  };

  const setAbTest = (id: number, isAbTest: boolean, abTrafficPercent?: number) => {
    api(`prompts/${id}/ab-test`, { method: 'PATCH', body: JSON.stringify({ isAbTest, abTrafficPercent }) }).then((r) => r.ok && load());
  };

  const saveEdit = () => {
    if (editingId == null) return;
    api(`prompts/${editingId}`, { method: 'PUT', body: JSON.stringify({ content: editContent }) })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setEditingId(null); setEditContent(''); })
      .catch(() => {});
  };

  const removePrompt = (id: number) => {
    if (!confirm('Удалить эту версию промпта?')) return;
    api(`prompts/${id}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  return (
    <section className="card">
      <h2>Промпты</h2>
      <p className="subtitle">Системные инструкции для бота. Активная версия по ключу <strong>dialog_system</strong> используется в диалоге и в тестовом чате.</p>
      <p className="subtitle" style={{ marginTop: '0.25rem' }}>В тексте можно использовать переменную <code style={{ background: 'var(--border)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>{'{{currentStep}}'}</code> — подставится этап воронки (ENGAGED, QUALIFYING и т.д.).</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ключ</th><th>Версия</th><th>Активен</th><th>A/B</th><th>Создан</th><th></th></tr></thead>
              <tbody>
                {groups.flatMap((g) => g.versions.map((v) => (
                  <tr key={v.id}>
                    <td>{g.key}</td>
                    <td>{v.version}</td>
                    <td>{v.isActive ? <span className="badge badge-success">да</span> : <span className="badge badge-muted">нет</span>}</td>
                    <td>{v.isAbTest ? `B ${v.abTrafficPercent ?? 50}%` : 'A'}</td>
                    <td>{formatDate(v.createdAt)}</td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" style={{ marginRight: '0.25rem' }} onClick={() => setViewPrompt({ key: g.key, content: v.content })}>Просмотр</button>
                      {!v.isActive && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActive(v.id, true)}>Сделать активным</button>}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingId(v.id); setEditContent(v.content); }}>Редактировать</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbTest(v.id, !v.isAbTest, v.abTrafficPercent ?? 50)}>{v.isAbTest ? 'Выкл A/B' : 'Вкл A/B'}</button>
                      <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => removePrompt(v.id)}>Удалить</button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          {viewPrompt !== null && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setViewPrompt(null)}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, maxWidth: 640, width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Промпт: {viewPrompt.key}</strong>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewPrompt(null)}>Закрыть</button>
                </div>
                <div style={{ padding: '1rem 1.25rem', overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {viewPrompt.content || '(пусто)'}
                </div>
              </div>
            </div>
          )}
          {editingId != null && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.95rem' }}>Редактирование контента</h3>
              <p className="subtitle" style={{ marginBottom: '0.5rem' }}>Можно использовать {'{{currentStep}}'} — подставится этап диалога.</p>
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10} style={{ width: '100%', marginTop: '0.5rem' }} />
              <div className="form-actions" style={{ marginTop: '0.5rem' }}><button type="button" className="btn btn-primary" onClick={saveEdit}>Сохранить</button><button type="button" className="btn btn-ghost" onClick={() => { setEditingId(null); setEditContent(''); }}>Отмена</button></div>
            </div>
          )}
          {!showAdd ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}>Добавить промпт (ключ / новая версия)</button>
          ) : (
            <form onSubmit={addPrompt} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row"><label>Ключ</label><input value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="dialog_system — основной промпт бота" required /></div>
              <div className="form-row"><label>Текст промпта (переменная {'{{currentStep}}'} подставится автоматически)</label><textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={8} style={{ width: '100%' }} /></div>
              <div className="form-actions"><button type="submit" className="btn btn-primary">Добавить</button><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Отмена</button></div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

function FollowupTemplatesSection() {
  const [data, setData] = useState<{ templates: { id: number; step: number; language: string; variant: string; content: string; isActive: boolean }[]; languages: string[]; variants: string[]; steps: number[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ step: 1, language: 'RU', variant: 'A', content: '' });
  const load = () => {
    setError(null);
    api('followup-templates')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError('Не удалось загрузить шаблоны'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    api('followup-templates', { method: 'POST', body: JSON.stringify(form) })
      .then((r) => r.ok ? load() : Promise.reject())
      .then(() => { setShowAdd(false); setForm({ step: 1, language: 'RU', variant: 'A', content: '' }); })
      .catch(() => {});
  };

  const removeTemplate = (id: number) => {
    if (!confirm('Удалить шаблон?')) return;
    api(`followup-templates/${id}`, { method: 'DELETE' }).then((r) => r.ok && load());
  };

  const list = data?.templates ?? [];
  return (
    <section className="card">
      <h2>Шаблоны follow-up</h2>
      <p className="subtitle">Мультиязычность (RU, KZ, SHALAKAZ) и варианты A/B по шагам 1–3.</p>
      {error && <p className="error-msg">{error}</p>}
      {loading ? <p className="subtitle">Загрузка…</p> : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Шаг</th><th>Язык</th><th>Вариант</th><th>Текст</th><th></th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td>{t.step}</td>
                    <td>{t.language}</td>
                    <td>{t.variant}</td>
                    <td style={{ maxWidth: 280 }}>{t.content?.slice(0, 80)}{t.content && t.content.length > 80 ? '…' : ''}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => removeTemplate(t.id)}>Удалить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!showAdd ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}>Добавить шаблон</button>
          ) : (
            <form onSubmit={addTemplate} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-row"><label>Шаг</label><select value={form.step} onChange={(e) => setForm((f) => ({ ...f, step: Number(e.target.value) }))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></div>
              <div className="form-row"><label>Язык</label><select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}><option value="RU">RU</option><option value="KZ">KZ</option><option value="SHALAKAZ">SHALAKAZ</option><option value="OTHER">OTHER</option></select></div>
              <div className="form-row"><label>Вариант</label><select value={form.variant} onChange={(e) => setForm((f) => ({ ...f, variant: e.target.value }))}><option value="A">A</option><option value="B">B</option></select></div>
              <div className="form-row"><label>Текст сообщения</label><textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} style={{ width: '100%' }} required /></div>
              <div className="form-actions"><button type="submit" className="btn btn-primary">Добавить</button><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Отмена</button></div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

type ChatMessage = { role: 'bot' | 'user'; text: string };

function TestSection() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScenario = () => {
    setError(null);
    setLoading(true);
    api('test/scenario/start', { method: 'POST' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as any)?.message || `Ошибка ${r.status}`);
        return data as { sessionId: string; initMessage: string };
      })
      .then((data) => {
        setSessionId(data.sessionId);
        setMessages([{ role: 'bot', text: data.initMessage }]);
      })
      .catch((err) => setError(err?.message || 'Не удалось запустить сценарий'))
      .finally(() => setLoading(false));
  };

  const endScenario = () => {
    if (!sessionId) return;
    setLoading(true);
    api(`test/${sessionId}/end`, { method: 'POST' })
      .then(() => {
        setSessionId(null);
        setMessages([]);
        setError(null);
      })
      .finally(() => setLoading(false));
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!sessionId || !text || loading) return;
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    api(`test/${sessionId}/send`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        history: messages.map((m) => ({
          role: m.role === 'bot' ? ('assistant' as const) : ('user' as const),
          content: m.text,
        })),
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof data?.message === 'string' ? data.message : `Ошибка ${r.status}`);
        return data as { reply: string };
      })
      .then((data: { reply: string }) => {
        setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
      })
      .catch((err: Error) => setError(err?.message ?? 'Ошибка ответа бота'))
      .finally(() => setLoading(false));
  };

  return (
    <section className="card">
      <h2>Тестирование бота</h2>
      <p className="subtitle">Переписка с ботом (DeepSeek) как в WhatsApp — проверка сценария</p>
      {error && <p className="error-msg">{error}</p>}
      <div className="test-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || !!sessionId}
          onClick={startScenario}
        >
          Запустить сценарий
        </button>
        {sessionId && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={endScenario}
          >
            Завершить сценарий
          </button>
        )}
      </div>
      <div className="chat-area">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <p className="chat-placeholder">
              {sessionId ? 'Напишите сообщение ниже.' : 'Нажмите «Запустить сценарий» — бот отправит первое сообщение. Отвечайте в поле ввода ниже.'}
            </p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                <span className="chat-msg-label">{msg.role === 'bot' ? 'Бот' : 'Вы'}</span>
                <span className="chat-msg-text">{msg.text}</span>
              </div>
            ))
          )}
        </div>
        <form onSubmit={sendMessage} className="chat-form">
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={sessionId ? 'Введите ответ...' : 'Сначала нажмите «Запустить сценарий»'}
            disabled={!sessionId || loading}
          />
          <button type="submit" className="btn btn-primary" disabled={!sessionId || loading || !input.trim()}>
            Отправить
          </button>
        </form>
      </div>
    </section>
  );
}
