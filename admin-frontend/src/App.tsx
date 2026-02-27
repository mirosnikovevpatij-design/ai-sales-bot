import React, { useEffect, useState } from 'react';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary';

type Tab = 'config' | 'managers' | 'stoplist' | 'sessions' | 'test';

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
  const [tab, setTab] = useState<Tab>('config');

  return (
    <div className="app">
      <header className="header">
        <h1>AI Sales Bot</h1>
        <span>· Админ-панель</span>
      </header>

      <main className="main">
        <nav className="tabs">
          <button className={tab === 'config' ? 'active' : ''} onClick={() => setTab('config')}>Конфиг</button>
          <button className={tab === 'managers' ? 'active' : ''} onClick={() => setTab('managers')}>Менеджеры</button>
          <button className={tab === 'stoplist' ? 'active' : ''} onClick={() => setTab('stoplist')}>Стоп-лист</button>
          <button className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>Сессии</button>
          <button className={tab === 'test' ? 'active' : ''} onClick={() => setTab('test')}>Тестирование бота</button>
        </nav>

        <div className="tab-content" style={{ minHeight: 200 }}>
          {tab === 'config' && <ErrorBoundary><ConfigSection /></ErrorBoundary>}
          {tab === 'managers' && <ErrorBoundary><ManagersSection /></ErrorBoundary>}
          {tab === 'stoplist' && <ErrorBoundary><StopListSection /></ErrorBoundary>}
          {tab === 'sessions' && <ErrorBoundary><SessionsSection /></ErrorBoundary>}
          {tab === 'test' && <ErrorBoundary><TestSection /></ErrorBoundary>}
        </div>
      </main>
    </div>
  );
};

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
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: { reply: string }) => {
        setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
      })
      .catch(() => setError('Ошибка ответа бота'))
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
