// Mobile App — single-file router + all pages
const { useState, useMemo, useEffect, useRef, useCallback } = React;
const I = window.I;

// =========================================================
// Helpers
// =========================================================
function navIcon(name) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg>;
    case 'tasks': return <svg {...common}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
    case 'invoice': return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>;
    case 'users': return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'menu': return <svg {...common}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
    default: return null;
  }
}

const Toaster = React.createContext(() => {});
function useToast() { return React.useContext(Toaster); }

// =========================================================
// Frame chrome
// =========================================================
function StatusBar() {
  return (
    <div className="statusbar">
      <div className="statusbar-time">9:41</div>
      <div className="statusbar-icons">
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="6.5" width="3" height="4.5" rx="0.7" fill="currentColor"/><rect x="4.5" y="4.5" width="3" height="6.5" rx="0.7" fill="currentColor"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.7" fill="currentColor"/><rect x="13.5" y="0" width="3" height="11" rx="0.7" fill="currentColor"/></svg>
        <svg width="15" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill="currentColor"/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill="currentColor"/><circle cx="8.5" cy="10.5" r="1.5" fill="currentColor"/></svg>
        <svg width="25" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="currentColor" fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

function BottomNav({ tab, navigate }) {
  const tabs = [
    { id: 'dashboard', label: 'Accueil', icon: 'home' },
    { id: 'tasks', label: 'Tasks', icon: 'tasks' },
    { id: 'billing', label: 'Factures', icon: 'invoice', dot: true },
    { id: 'clients', label: 'Clients', icon: 'users' },
    { id: 'more', label: 'Plus', icon: 'menu' },
  ];
  return (
    <div className="bottom-nav">
      {tabs.map(t => (
        <button key={t.id} className={'nav-tab' + (tab === t.id ? ' active' : '')} onClick={() => navigate({ page: t.id })}>
          {navIcon(t.icon)}
          <span className="lbl">{t.label}</span>
          {t.dot && t.id !== tab && <span className="dot"></span>}
        </button>
      ))}
    </div>
  );
}

// =========================================================
// Auth
// =========================================================
function PageLogin({ navigate, switchTo }) {
  const [email, setEmail] = useState('tristan@freelance.app');
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const toast = useToast();
  const submit = (e) => { e?.preventDefault(); if (!email || !pwd) return; toast('Connexion réussie'); navigate({ page: 'dashboard' }); };
  return (
    <div className="auth-screen">
      <div className="auth-logo-row">
        <div className="auth-logo-mark">F</div>
        <div>
          <div className="strong">FreelanceManager</div>
          <div className="xs muted">v0.4 · perso</div>
        </div>
      </div>
      <h1 className="auth-headline">Bon retour, <br/>reprenons.</h1>
      <p className="auth-sub">Reprends le contrôle de ta facturation freelance.</p>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label">Email</label>
          <div className="auth-input-wrap">
            <I name="mail" size={16} className="lead-ic"/>
            <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@exemple.com"/>
          </div>
        </div>
        <div className="field">
          <label className="field-label">Mot de passe</label>
          <div className="auth-input-wrap">
            <I name="lock" size={16} className="lead-ic"/>
            <input className="auth-input" type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"/>
            <button type="button" className="auth-toggle-pwd" onClick={() => setShow(s => !s)}><I name={show ? 'eye-off' : 'eye'} size={16}/></button>
          </div>
          <div style={{ textAlign: 'right' }}><span className="auth-link xs">Mot de passe oublié ?</span></div>
        </div>
        <button type="submit" className="auth-cta">Se connecter <I name="arrow-right" size={14}/></button>
      </form>
      <div className="auth-divider">ou</div>
      <div className="auth-oauth-row">
        <button className="auth-oauth"><svg width="14" height="14" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10v3.6h5.1c-.2 1.4-1.6 4.2-5.1 4.2-3.1 0-5.6-2.5-5.6-5.7s2.5-5.7 5.6-5.7c1.7 0 2.9.7 3.6 1.4l2.4-2.4C16.4 4 14.4 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 9.4-4.8 9.4-7.4 0-.5-.1-.9-.1-1.3H12z"/></svg>Google</button>
        <button className="auth-oauth"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>GitHub</button>
      </div>
      <div className="auth-bottom">Pas encore de compte ? <span className="auth-link" onClick={() => switchTo('register')}>Créer un compte</span></div>
    </div>
  );
}

function PageRegister({ navigate, switchTo }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pwd, setPwd] = useState(''); const [show, setShow] = useState(false);
  const toast = useToast();
  const score = (() => { let s = 0; if (pwd.length >= 8) s++; if (/[A-Z]/.test(pwd)) s++; if (/[0-9]/.test(pwd)) s++; if (/[^A-Za-z0-9]/.test(pwd) || pwd.length >= 12) s++; return Math.min(s, 4); })();
  const submit = (e) => { e?.preventDefault(); if (!name || !email || !pwd) return; toast('Compte créé · bienvenue !'); navigate({ page: 'dashboard' }); };
  return (
    <div className="auth-screen">
      <div className="auth-logo-row">
        <div className="auth-logo-mark">F</div>
        <div>
          <div className="strong">FreelanceManager</div>
          <div className="xs muted">v0.4 · perso</div>
        </div>
      </div>
      <h1 className="auth-headline">Démarre <br/>en 30 secondes.</h1>
      <p className="auth-sub">Connecte ton Linear, suis ta pipeline, fais grandir ton activité.</p>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label">Nom complet</label>
          <div className="auth-input-wrap"><I name="user" size={16} className="lead-ic"/><input className="auth-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tristan Hourtoulle"/></div>
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <div className="auth-input-wrap"><I name="mail" size={16} className="lead-ic"/><input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@exemple.com"/></div>
        </div>
        <div className="field">
          <label className="field-label">Mot de passe</label>
          <div className="auth-input-wrap"><I name="lock" size={16} className="lead-ic"/><input className="auth-input" type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••"/>
            <button type="button" className="auth-toggle-pwd" onClick={() => setShow(s => !s)}><I name={show ? 'eye-off' : 'eye'} size={16}/></button>
          </div>
          <div className="pwd-strength">{[1,2,3,4].map(n => <div key={n} className={'pwd-strength-bar' + (n <= score ? ' on-' + score : '')}></div>)}</div>
          <div className="xs muted" style={{ marginTop: 4 }}>{['Trop court','Faible','Correct','Fort','Excellent'][score]}</div>
        </div>
        <button type="submit" className="auth-cta">Créer mon compte <I name="arrow-right" size={14}/></button>
      </form>
      <div className="auth-bottom">Déjà un compte ? <span className="auth-link" onClick={() => switchTo('login')}>Se connecter</span></div>
    </div>
  );
}

// =========================================================
// Dashboard
// =========================================================
function PageDashboard({ store, navigate }) {
  const { fmtEUR, fmtRelative } = window.FM;
  const today = new Date('2026-04-30');
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const paid = store.invoices.filter(i => i.status === 'paid');
  const revMonth = paid.filter(i => new Date(i.paidDate) >= monthStart).reduce((s, i) => s + i.total, 0);
  const revYear = paid.filter(i => new Date(i.paidDate) >= yearStart).reduce((s, i) => s + i.total, 0);
  const pipelineTasks = store.tasks.filter(t => t.status === 'pending_invoice');
  const pipeline = pipelineTasks.reduce((s, t) => {
    const c = store.clients.find(c => c.id === t.clientId);
    if (!c || c.billingType !== 'daily') return s + (t.estimate * 500);
    return s + t.estimate * c.rate;
  }, 0);
  const outstanding = store.invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const overdueInvoices = store.invoices.filter(i => i.status === 'overdue');

  // 12-month chart
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const v = paid.filter(inv => { const d = new Date(inv.paidDate); return d >= start && d < end; }).reduce((s, i) => s + i.total, 0);
    months.push({ label: start.toLocaleDateString('fr-FR', { month: 'short' }), value: v || (1500 + Math.round(Math.random() * 4000)), isCurrent: i === 0 });
  }

  const recentTasks = store.tasks.filter(t => t.completedAt).sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 4);

  return (
    <div className="screen">
      <div className="topbar">
        <div className="av av-sm" style={{ background: 'linear-gradient(135deg, oklch(0.55 0.12 250), oklch(0.55 0.18 320))' }}>{window.FM.initials(store.me.name)}</div>
        <div className="grow">
          <div className="xs muted">Bonjour</div>
          <div className="strong" style={{ fontSize: 14 }}>{store.me.name.split(' ')[0]}</div>
        </div>
        <button className="topbar-action" onClick={() => navigate({ page: 'analytics' })}><I name="chart" size={17}/></button>
      </div>

      <div className="scroll">
        <div className="big-header">
          <div className="big-title">Pilotage</div>
          <div className="big-sub">Avril 2026 · vue d'ensemble</div>
        </div>

        {/* KPI grid */}
        <div className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="kpi-tile accent">
              <div className="kpi-label"><I name="euro" size={11}/>Mois</div>
              <div className="kpi-value">{fmtEUR(revMonth)}</div>
              <div className="kpi-sub"><span className="kpi-trend up"><I name="arrow-up" size={9}/>+18%</span></div>
            </div>
            <div className="kpi-tile info">
              <div className="kpi-label"><I name="chart" size={11}/>Année</div>
              <div className="kpi-value">{fmtEUR(revYear)}</div>
              <div className="kpi-sub muted">YTD · {paid.length} factures</div>
            </div>
            <div className="kpi-tile warn">
              <div className="kpi-label"><I name="clock" size={11}/>Pipeline</div>
              <div className="kpi-value">{fmtEUR(pipeline)}</div>
              <div className="kpi-sub muted">{pipelineTasks.length} tasks à facturer</div>
            </div>
            <div className="kpi-tile danger">
              <div className="kpi-label"><I name="invoice" size={11}/>Encours</div>
              <div className="kpi-value">{fmtEUR(outstanding)}</div>
              <div className="kpi-sub muted">{overdueInvoices.length} en retard</div>
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div className="card-title"><span>Revenus 6 derniers mois</span><span className="muted xs mono">{fmtEUR(months.reduce((s, m) => s + m.value, 0))}</span></div>
            <BarChart months={months}/>
          </div>

          {/* Overdue alert */}
          {overdueInvoices.length > 0 && (
            <div className="card" style={{ borderLeft: '2px solid var(--danger)' }}>
              <div className="row gap-8" style={{ marginBottom: 8 }}>
                <I name="alert" size={14} style={{ color: 'var(--danger)' }}/>
                <div className="strong small">{overdueInvoices.length} facture en retard</div>
              </div>
              {overdueInvoices.slice(0, 2).map(inv => {
                const c = store.clients.find(cl => cl.id === inv.clientId);
                return (
                  <div key={inv.id} className="row gap-8" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                    <div className="grow">
                      <div className="small strong truncate">{c?.company}</div>
                      <div className="xs muted">{inv.number} · échue {fmtRelative(inv.dueDate)}</div>
                    </div>
                    <div className="num strong" style={{ color: 'var(--danger)' }}>{fmtEUR(inv.total)}</div>
                  </div>
                );
              })}
              <button className="btn btn-secondary btn-block btn-sm" style={{ marginTop: 8 }} onClick={() => navigate({ page: 'billing', filter: 'overdue' })}>Tout voir</button>
            </div>
          )}

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => navigate({ page: 'invoice-new' })}><I name="plus" size={13}/>Nouvelle facture</button>
            <button className="btn btn-secondary" onClick={() => navigate({ page: 'tasks' })}><I name="sync" size={13}/>Sync Linear</button>
          </div>

          {/* Recent activity */}
          <div className="card">
            <div className="card-title"><span>Activité récente</span><span className="sec-link" onClick={() => navigate({ page: 'tasks' })}>Tasks →</span></div>
            <div className="col gap-8" style={{ marginTop: -4 }}>
              {recentTasks.map(t => {
                const c = store.clients.find(cl => cl.id === t.clientId);
                return (
                  <div key={t.id} className="row gap-8" style={{ padding: '6px 0' }} onClick={() => navigate({ page: 'tasks' })}>
                    <span className={'pill no-dot ' + (t.status === 'done' ? 'pill-done' : 'pill-pending')} style={{ width: 8, height: 8, padding: 0, flexShrink: 0 }}></span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong truncate">{t.title}</div>
                      <div className="xs muted">{t.linearId} · {c?.company} · {fmtRelative(t.completedAt)}</div>
                    </div>
                    <div className="xs num muted">{t.estimate}j</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarChart({ months }) {
  const max = Math.max(...months.map(m => m.value), 1);
  const W = 320, H = 140, pad = 24;
  const innerW = W - pad * 2, innerH = H - 30;
  const stepX = innerW / months.length;
  const barW = stepX * 0.42;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140 }}>
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.19 128)" stopOpacity="1"/>
          <stop offset="100%" stopColor="oklch(0.86 0.19 128)" stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      {months.map((m, i) => {
        const x = pad + i * stepX + (stepX - barW) / 2;
        const h = (m.value / max) * innerH;
        const y = innerH - h + 6;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="3" fill={m.isCurrent ? 'url(#bar)' : 'oklch(0.30 0.01 240)'}/>
            <text x={pad + i * stepX + stepX / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={m.isCurrent ? 'var(--text-0)' : 'var(--text-3)'} fontWeight={m.isCurrent ? 600 : 400}>{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// =========================================================
// Tasks
// =========================================================
function PageTasks({ store, setStore, navigate, route }) {
  const { initials } = window.FM;
  const [filter, setFilter] = useState(route?.filter || 'all');
  const [selected, setSelected] = useState(new Set());
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();

  const tasks = store.tasks.filter(t => t.status === 'pending_invoice' || t.status === 'done').filter(t => {
    if (filter === 'pending') return t.status === 'pending_invoice';
    if (filter === 'done') return t.status === 'done' && t.invoiceId == null;
    if (filter === 'invoiced') return t.invoiceId != null;
    return t.status === 'pending_invoice' || (t.status === 'done' && t.invoiceId == null);
  }).sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  // Group by client
  const grouped = {};
  tasks.forEach(t => {
    const c = store.clients.find(cl => cl.id === t.clientId);
    const key = c?.id || 'unknown';
    if (!grouped[key]) grouped[key] = { client: c, tasks: [] };
    grouped[key].tasks.push(t);
  });

  const toggle = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sync = () => { setSyncing(true); setTimeout(() => { setSyncing(false); toast('Sync Linear · 47 tasks à jour'); }, 1400); };
  const facturer = () => {
    const ids = [...selected];
    const tasksSel = tasks.filter(t => ids.includes(t.id));
    if (!tasksSel.length) return;
    const clientId = tasksSel[0].clientId;
    if (!tasksSel.every(t => t.clientId === clientId)) { toast('Sélectionne tasks d\'un même client'); return; }
    navigate({ page: 'invoice-new', clientId, taskIds: ids });
  };

  const counts = {
    all: store.tasks.filter(t => t.status === 'pending_invoice' || (t.status === 'done' && t.invoiceId == null)).length,
    pending: store.tasks.filter(t => t.status === 'pending_invoice').length,
    invoiced: store.tasks.filter(t => t.invoiceId != null).length,
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">Tasks</div>
        <button className={'topbar-action ' + (syncing ? '' : 'primary')} onClick={sync} disabled={syncing}>
          <span style={{ display: 'inline-flex', animation: syncing ? 'spin 1s linear infinite' : 'none' }}><I name="sync" size={15}/></span>
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="scroll">
        <div className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="big-title" style={{ fontSize: 24, padding: 0 }}>Linear · Tasks</div>
            <div className="sync-pill"><span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: 99 }}></span>il y a 12 min</div>
          </div>

          <div className="chip-row">
            <button className={'chip ' + (filter === 'all' ? 'active' : '')} onClick={() => setFilter('all')}>Tous <span className="count">{counts.all}</span></button>
            <button className={'chip ' + (filter === 'pending' ? 'active' : '')} onClick={() => setFilter('pending')}>À facturer <span className="count">{counts.pending}</span></button>
            <button className={'chip ' + (filter === 'done' ? 'active' : '')} onClick={() => setFilter('done')}>Done</button>
            <button className={'chip ' + (filter === 'invoiced' ? 'active' : '')} onClick={() => setFilter('invoiced')}>Facturée <span className="count">{counts.invoiced}</span></button>
          </div>

          {Object.values(grouped).map(({ client, tasks }) => client && (
            <div key={client.id} className="col gap-8">
              <div className="row gap-8" style={{ padding: '4px 0' }}>
                <div className="av av-sm" style={{ background: client.color }}>{initials(`${client.firstName} ${client.lastName}`)}</div>
                <div className="grow">
                  <div className="small strong">{client.company}</div>
                  <div className="xs muted">{tasks.length} tasks · {client.billingType === 'daily' ? `${client.rate} €/j` : client.billingType === 'hourly' ? `${client.rate} €/h` : 'Forfait'}</div>
                </div>
              </div>
              {tasks.map(t => (
                <div key={t.id} className={'task-item' + (selected.has(t.id) ? ' selected' : '')} onClick={() => t.invoiceId == null && toggle(t.id)}>
                  <div className="row gap-8">
                    <div className={'checkbox-circle' + (selected.has(t.id) ? ' checked' : '')}>{selected.has(t.id) && <I name="check" size={13}/>}</div>
                    <span className="task-id">{t.linearId}</span>
                    <span className={'pill ' + (t.status === 'done' ? 'pill-done' : 'pill-pending')} style={{ marginLeft: 'auto' }}>{t.status === 'done' ? 'Done' : 'À facturer'}</span>
                  </div>
                  <div className="task-title">{t.title}</div>
                  <div className="task-meta">
                    <span><I name="clock" size={11}/> {t.estimate}j</span>
                    <span>·</span>
                    <span className="num">{window.FM.fmtEUR(t.estimate * (client.rate || 500))}</span>
                    {t.invoiceId && <><span>·</span><span style={{ color: 'var(--accent)' }}>Facturée</span></>}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {tasks.length === 0 && <div className="empty"><div className="empty-title">Aucune task</div><div>Change le filtre ou sync depuis Linear</div></div>}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky-cta">
          <div className="grow">
            <div className="strong small">{selected.size} task{selected.size > 1 ? 's' : ''}</div>
            <div className="xs muted">prête{selected.size > 1 ? 's' : ''} pour la facturation</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={facturer}><I name="invoice" size={13}/>Facturer</button>
        </div>
      )}
    </div>
  );
}

// =========================================================
// Clients
// =========================================================
function PageClients({ store, setStore, navigate }) {
  const { initials, fmtEUR } = window.FM;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showSheet, setShowSheet] = useState(false);
  const toast = useToast();

  const clients = store.clients.filter(c => !c.archived).filter(c => {
    if (filter !== 'all' && c.billingType !== filter) return false;
    if (!q) return true;
    return (c.firstName + ' ' + c.lastName + ' ' + c.company).toLowerCase().includes(q.toLowerCase());
  });

  const stats = (cId) => {
    const projects = store.projects.filter(p => p.clientId === cId).length;
    const revenue = store.invoices.filter(i => i.clientId === cId && i.status === 'paid').reduce((s, i) => s + i.total, 0);
    const pipelineTasks = store.tasks.filter(t => t.clientId === cId && t.status === 'pending_invoice');
    return { projects, revenue, pipelineCount: pipelineTasks.length };
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">Clients</div>
        <button className="topbar-action primary" onClick={() => setShowSheet(true)}><I name="plus" size={16}/></button>
      </div>

      <div className="scroll">
        <div className="stack">
          <div className="searchbar"><I name="search" size={14} className="muted"/><input placeholder="Rechercher un client" value={q} onChange={e => setQ(e.target.value)}/></div>
          <div className="chip-row">
            {[['all','Tous'], ['daily','TJM'], ['fixed','Forfait'], ['hourly','Horaire']].map(([k, l]) => (
              <button key={k} className={'chip ' + (filter === k ? 'active' : '')} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          <div className="col gap-8">
            {clients.map(c => {
              const s = stats(c.id);
              return (
                <div key={c.id} className="card" style={{ padding: 14 }} onClick={() => navigate({ page: 'client-detail', clientId: c.id })}>
                  <div className="row gap-12">
                    <div className="av" style={{ background: c.color }}>{initials(`${c.firstName} ${c.lastName}`)}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong truncate">{c.company}</div>
                      <div className="xs muted truncate">{c.firstName} {c.lastName}</div>
                    </div>
                    <span className={'pill no-dot pill-' + c.billingType}>{c.billingType === 'daily' ? `${c.rate}€/j` : c.billingType === 'hourly' ? `${c.rate}€/h` : 'Forfait'}</span>
                  </div>
                  <div className="divider"></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <div><div className="xs muted-2" style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 10 }}>Projets</div><div className="num strong small" style={{ marginTop: 2 }}>{s.projects}</div></div>
                    <div><div className="xs muted-2" style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 10 }}>À facturer</div><div className="num strong small" style={{ marginTop: 2 }}>{s.pipelineCount}</div></div>
                    <div><div className="xs muted-2" style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: 10 }}>Revenu</div><div className="num strong small" style={{ marginTop: 2, color: 'var(--accent)' }}>{fmtEUR(s.revenue)}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSheet && (
        <NewClientSheet onClose={() => setShowSheet(false)} onSave={(c) => {
          setStore(s => ({ ...s, clients: [...s.clients, c] }));
          setShowSheet(false);
          toast('Client ajouté');
        }}/>
      )}
    </div>
  );
}

function NewClientSheet({ onClose, onSave }) {
  const [data, setData] = useState({ firstName: '', lastName: '', company: '', email: '', billingType: 'daily', rate: 600 });
  const colors = ['linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.18 320))', 'linear-gradient(135deg, oklch(0.6 0.15 30), oklch(0.55 0.18 60))', 'linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))'];
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose}></div>
      <div className="sheet">
        <div className="sheet-handle"></div>
        <div className="sheet-title">Nouveau client</div>
        <div className="sheet-sub">Renseigne les informations principales</div>
        <div className="sheet-fields">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field"><label className="field-label">Prénom</label><input className="input" value={data.firstName} onChange={e => setData({ ...data, firstName: e.target.value })}/></div>
            <div className="field"><label className="field-label">Nom</label><input className="input" value={data.lastName} onChange={e => setData({ ...data, lastName: e.target.value })}/></div>
          </div>
          <div className="field"><label className="field-label">Entreprise</label><input className="input" value={data.company} onChange={e => setData({ ...data, company: e.target.value })}/></div>
          <div className="field"><label className="field-label">Email</label><input className="input" type="email" value={data.email} onChange={e => setData({ ...data, email: e.target.value })}/></div>
          <div className="field"><label className="field-label">Type de facturation</label>
            <div className="seg">
              {[['daily','TJM'],['fixed','Forfait'],['hourly','Horaire']].map(([k,l]) =>
                <button key={k} className={data.billingType === k ? 'active' : ''} onClick={() => setData({ ...data, billingType: k })}>{l}</button>
              )}
            </div>
          </div>
          {data.billingType !== 'fixed' && (
            <div className="field"><label className="field-label">{data.billingType === 'daily' ? 'TJM (€/jour)' : 'Taux horaire (€/h)'}</label><input className="input" type="number" value={data.rate} onChange={e => setData({ ...data, rate: +e.target.value })}/></div>
          )}
          <div className="row gap-8" style={{ marginTop: 8 }}>
            <button className="btn btn-secondary grow" onClick={onClose}>Annuler</button>
            <button className="btn btn-primary grow" onClick={() => onSave({ ...data, id: 'c' + Date.now(), color: colors[Math.floor(Math.random() * 3)], createdAt: new Date().toISOString().slice(0, 10), archived: false, tag: 'Freelance' })}>Créer</button>
          </div>
        </div>
      </div>
    </>
  );
}

// =========================================================
// Client Detail
// =========================================================
function PageClientDetail({ store, route, navigate }) {
  const c = store.clients.find(cc => cc.id === route.clientId);
  const { initials, fmtEUR, fmtRelative } = window.FM;
  const [tab, setTab] = useState('overview');
  if (!c) return <div className="screen"><div className="topbar"><button className="topbar-back" onClick={() => navigate({ page: 'clients' })}><I name="chevron-left" size={16}/></button></div><div className="empty">Client introuvable</div></div>;

  const projects = store.projects.filter(p => p.clientId === c.id);
  const tasks = store.tasks.filter(t => t.clientId === c.id);
  const invoices = store.invoices.filter(i => i.clientId === c.id);
  const pipeline = tasks.filter(t => t.status === 'pending_invoice').reduce((s, t) => s + t.estimate * (c.rate || 500), 0);
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate({ page: 'clients' })}><I name="chevron-left" size={16}/></button>
        <div className="topbar-title truncate">{c.company}</div>
        <button className="topbar-action"><I name="more" size={16}/></button>
      </div>

      <div className="scroll">
        <div className="detail-hero">
          <div className="av av-lg" style={{ background: c.color }}>{initials(`${c.firstName} ${c.lastName}`)}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong" style={{ fontSize: 18 }}>{c.firstName} {c.lastName}</div>
            <div className="xs muted truncate">{c.email}</div>
            <div className="row gap-6" style={{ marginTop: 6 }}>
              <span className={'pill no-dot pill-' + c.billingType}>{c.billingType === 'daily' ? `${c.rate} €/jour` : c.billingType === 'hourly' ? `${c.rate} €/h` : `Forfait ${fmtEUR(c.fixedPrice)}`}</span>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat"><div className="hero-stat-label">Revenu</div><div className="hero-stat-value" style={{ color: 'var(--accent)' }}>{fmtEUR(revenue)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">À facturer</div><div className="hero-stat-value">{fmtEUR(pipeline)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Encours</div><div className="hero-stat-value" style={{ color: outstanding > 0 ? 'var(--info)' : 'var(--text-1)' }}>{fmtEUR(outstanding)}</div></div>
          <div className="hero-stat"><div className="hero-stat-label">Projets</div><div className="hero-stat-value">{projects.length}</div></div>
        </div>

        <div style={{ padding: '0 14px' }}>
          <div className="seg">
            {[['overview','Vue'],['projects','Projets'],['tasks','Tasks'],['invoices','Factures']].map(([k, l]) =>
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
            )}
          </div>
        </div>

        <div className="stack" style={{ marginTop: 14 }}>
          {tab === 'overview' && (
            <>
              <div className="card">
                <div className="card-title">Coordonnées</div>
                <div className="col gap-8">
                  <div className="row gap-8"><I name="mail" size={13} className="muted"/><span className="small">{c.email}</span></div>
                  <div className="row gap-8"><I name="briefcase" size={13} className="muted"/><span className="small">{c.tag}</span></div>
                  <div className="row gap-8"><I name="calendar" size={13} className="muted"/><span className="small">Client depuis {fmtRelative(c.createdAt)}</span></div>
                </div>
              </div>
              {c.deposit && (
                <div className="card">
                  <div className="card-title">Acompte</div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div><div className="small">Acompte configuré</div><div className="xs muted">30% du forfait</div></div>
                    <div className="num strong">{fmtEUR(c.deposit)}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'projects' && (
            <div className="col gap-8">
              {projects.map(p => (
                <div key={p.id} className="card card-tight">
                  <div className="row gap-8">
                    <I name="folder" size={14} style={{ color: 'var(--info)' }}/>
                    <div className="grow"><div className="strong small truncate">{p.name}</div><div className="xs muted truncate">{p.desc}</div></div>
                    <span className="task-id">{p.key}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="col gap-8">
              {tasks.slice(0, 12).map(t => (
                <div key={t.id} className="task-item">
                  <div className="row gap-8"><span className="task-id">{t.linearId}</span><span className={'pill no-dot ' + (t.status === 'done' ? 'pill-done' : t.status === 'pending_invoice' ? 'pill-pending' : 'pill-draft')} style={{ marginLeft: 'auto' }}>{t.status === 'done' ? 'Done' : t.status === 'pending_invoice' ? 'À facturer' : t.status}</span></div>
                  <div className="task-title">{t.title}</div>
                </div>
              ))}
            </div>
          )}

          {tab === 'invoices' && (
            <div className="col gap-8">
              {invoices.map(inv => (
                <div key={inv.id} className="card card-tight" onClick={() => navigate({ page: 'billing', invoiceId: inv.id })}>
                  <div className="row gap-8">
                    <div className="grow"><div className="strong small">{inv.number}</div><div className="xs muted">{window.FM.fmtDate(inv.issueDate)}</div></div>
                    <div className="num strong">{fmtEUR(inv.total)}</div>
                    <span className={'pill pill-' + inv.status}>{({ paid:'Payée', sent:'Envoyée', overdue:'Retard', draft:'Brouillon' })[inv.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Projects
// =========================================================
function PageProjects({ store, navigate }) {
  const { fmtEUR, initials } = window.FM;
  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate({ page: 'more' })}><I name="chevron-left" size={16}/></button>
        <div className="topbar-title">Projets</div>
        <button className="topbar-action"><I name="plus" size={16}/></button>
      </div>
      <div className="scroll">
        <div className="big-header"><div className="big-title">Projets</div><div className="big-sub">{store.projects.length} projets · synchronisés Linear</div></div>
        <div className="stack">
          {store.projects.map(p => {
            const c = store.clients.find(cl => cl.id === p.clientId);
            const tasks = store.tasks.filter(t => t.projectId === p.id);
            const done = tasks.filter(t => t.status === 'done').length;
            const total = tasks.length;
            const revenue = store.invoices.filter(i => i.projectId === p.id && i.status === 'paid').reduce((s, i) => s + i.total, 0);
            return (
              <div key={p.id} className="card" onClick={() => navigate({ page: 'client-detail', clientId: p.clientId })}>
                <div className="row gap-12">
                  <div className="av av-sm" style={{ background: c?.color }}>{c && initials(`${c.firstName} ${c.lastName}`)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong small truncate">{p.name}</div>
                    <div className="xs muted truncate">{c?.company}</div>
                  </div>
                  <span className="task-id">{p.key}</span>
                </div>
                <div className="xs muted" style={{ marginTop: 8 }}>{p.desc}</div>
                <div className="divider"></div>
                <div className="row gap-12">
                  <div className="grow">
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="xs muted">{done}/{total} tasks done</span>
                      <span className="xs num strong" style={{ color: 'var(--accent)' }}>{fmtEUR(revenue)}</span>
                    </div>
                    <div className="pbar"><span style={{ width: total ? `${(done / total) * 100}%` : '0%' }}></span></div>
                  </div>
                  <span className={'pill no-dot ' + (p.status === 'active' ? 'pill-done' : 'pill-draft')}>{p.status === 'active' ? 'Actif' : 'Pause'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Billing
// =========================================================
function PageBilling({ store, setStore, navigate, route }) {
  const { fmtEUR, fmtDate, fmtRelative, initials } = window.FM;
  const [filter, setFilter] = useState(route?.filter || 'all');
  const [drawer, setDrawer] = useState(route?.invoiceId ? store.invoices.find(i => i.id === route.invoiceId) : null);
  const toast = useToast();

  const invoices = store.invoices.filter(i => filter === 'all' || i.status === filter).sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
  const counts = ['draft','sent','paid','overdue'].reduce((acc, s) => { acc[s] = store.invoices.filter(i => i.status === s).length; return acc; }, {});

  const updateStatus = (inv, newStatus) => {
    setStore(s => ({ ...s, invoices: s.invoices.map(i => i.id === inv.id ? { ...i, status: newStatus, paidDate: newStatus === 'paid' ? new Date().toISOString().slice(0,10) : i.paidDate } : i) }));
    toast(newStatus === 'paid' ? 'Facture marquée payée' : newStatus === 'sent' ? 'Facture envoyée' : 'Mise à jour');
    setDrawer(null);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">Factures</div>
        <button className="topbar-action primary" onClick={() => navigate({ page: 'invoice-new' })}><I name="plus" size={16}/></button>
      </div>
      <div className="scroll">
        <div className="stack">
          <div className="chip-row">
            <button className={'chip ' + (filter === 'all' ? 'active' : '')} onClick={() => setFilter('all')}>Toutes <span className="count">{store.invoices.length}</span></button>
            <button className={'chip ' + (filter === 'draft' ? 'active' : '')} onClick={() => setFilter('draft')}>Brouillon <span className="count">{counts.draft}</span></button>
            <button className={'chip ' + (filter === 'sent' ? 'active' : '')} onClick={() => setFilter('sent')}>Envoyées <span className="count">{counts.sent}</span></button>
            <button className={'chip ' + (filter === 'overdue' ? 'active' : '')} onClick={() => setFilter('overdue')}>Retard <span className="count">{counts.overdue}</span></button>
            <button className={'chip ' + (filter === 'paid' ? 'active' : '')} onClick={() => setFilter('paid')}>Payées <span className="count">{counts.paid}</span></button>
          </div>

          <div className="col gap-8">
            {invoices.map(inv => {
              const c = store.clients.find(cl => cl.id === inv.clientId);
              return (
                <div key={inv.id} className="card card-tight" onClick={() => setDrawer(inv)}>
                  <div className="row gap-10">
                    <div className="av av-sm" style={{ background: c?.color }}>{c && initials(`${c.firstName} ${c.lastName}`)}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6">
                        <span className="strong small truncate">{c?.company}</span>
                        {inv.kind === 'deposit' && <span className="pill no-dot pill-deposit xs">Acompte</span>}
                      </div>
                      <div className="xs muted">{inv.number} · {fmtDate(inv.issueDate)}</div>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                      <div className="num strong small">{fmtEUR(inv.total)}</div>
                      <span className={'pill pill-' + inv.status}>{({ paid:'Payée', sent:'Envoyée', overdue:'Retard', draft:'Brouillon' })[inv.status]}</span>
                    </div>
                  </div>
                  {inv.status === 'overdue' && <div className="xs" style={{ color: 'var(--danger)', marginTop: 8 }}>Échue {fmtRelative(inv.dueDate)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {drawer && (() => {
        const c = store.clients.find(cl => cl.id === drawer.clientId);
        return (
          <>
            <div className="sheet-backdrop" onClick={() => setDrawer(null)}></div>
            <div className="sheet" style={{ maxHeight: '80%' }}>
              <div className="sheet-handle"></div>
              <div className="row gap-10" style={{ marginBottom: 14 }}>
                <div className="av" style={{ background: c?.color }}>{c && initials(`${c.firstName} ${c.lastName}`)}</div>
                <div className="grow">
                  <div className="strong">{drawer.number}</div>
                  <div className="xs muted">{c?.company}</div>
                </div>
                <span className={'pill pill-' + drawer.status}>{({ paid:'Payée', sent:'Envoyée', overdue:'Retard', draft:'Brouillon' })[drawer.status]}</span>
              </div>
              <div className="card card-tight" style={{ marginBottom: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="xs muted">Émise le</span><span className="small">{fmtDate(drawer.issueDate)}</span></div>
                <div className="divider" style={{ margin: '8px 0' }}></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="xs muted">Échéance</span><span className="small">{fmtDate(drawer.dueDate)}</span></div>
                {drawer.paidDate && <><div className="divider" style={{ margin: '8px 0' }}></div><div className="row" style={{ justifyContent: 'space-between' }}><span className="xs muted">Payée le</span><span className="small" style={{ color: 'var(--accent)' }}>{fmtDate(drawer.paidDate)}</span></div></>}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Lignes ({drawer.lineItems.length})</div>
                <div className="col gap-6">
                  {drawer.lineItems.map((li, i) => (
                    <div key={i} className="row gap-8" style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 8 }}>
                      <div className="grow" style={{ minWidth: 0 }}><div className="small truncate">{li.label}</div><div className="xs muted mono">{li.qty} × {fmtEUR(li.rate)}</div></div>
                      <div className="num strong small">{fmtEUR(li.qty * li.rate)}</div>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}><span className="strong">Total</span><span className="num strong" style={{ fontSize: 18, color: 'var(--accent)' }}>{fmtEUR(drawer.total)}</span></div>
              </div>
              <div className="row gap-8">
                {drawer.status === 'draft' && <button className="btn btn-primary grow" onClick={() => updateStatus(drawer, 'sent')}><I name="send" size={13}/>Envoyer</button>}
                {(drawer.status === 'sent' || drawer.status === 'overdue') && <button className="btn btn-primary grow" onClick={() => updateStatus(drawer, 'paid')}><I name="check" size={13}/>Marquer payée</button>}
                <button className="btn btn-secondary" onClick={() => setDrawer(null)}>Fermer</button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// =========================================================
// Invoice New (mobile flow — sequential)
// =========================================================
function PageInvoiceNew({ store, setStore, navigate, route }) {
  const { fmtEUR, initials } = window.FM;
  const [step, setStep] = useState(route?.clientId ? 2 : 1);
  const [clientId, setClientId] = useState(route?.clientId || null);
  const [kind, setKind] = useState('standard');
  const [selectedTasks, setSelectedTasks] = useState(new Set(route?.taskIds || []));
  const [extraLines, setExtraLines] = useState([]);
  const [depositAmount, setDepositAmount] = useState(0);
  const toast = useToast();

  const client = store.clients.find(c => c.id === clientId);
  const availableTasks = client ? store.tasks.filter(t => t.clientId === clientId && (t.status === 'pending_invoice' || t.status === 'done') && t.invoiceId == null) : [];

  const lines = [
    ...availableTasks.filter(t => selectedTasks.has(t.id)).map(t => ({ taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty: t.estimate, rate: client?.rate || 500 })),
    ...extraLines,
    ...(kind === 'deposit' ? [{ taskId: null, label: `Acompte — ${client?.company || ''}`, qty: 1, rate: depositAmount }] : []),
  ];
  const total = lines.reduce((s, l) => s + l.qty * l.rate, 0);

  useEffect(() => { if (client?.deposit && kind === 'deposit') setDepositAmount(client.deposit); }, [client, kind]);

  const create = (statusVal) => {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(); due.setDate(due.getDate() + 30);
    const inv = {
      id: 'inv-' + Date.now(),
      number: `${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}`,
      clientId,
      projectId: client && store.projects.find(p => p.clientId === clientId)?.id,
      status: statusVal,
      kind,
      issueDate: today,
      dueDate: due.toISOString().slice(0, 10),
      paidDate: null,
      lineItems: lines,
      subtotal: total,
      tax: 0,
      total,
      notes: '',
    };
    const updatedTasks = store.tasks.map(t => selectedTasks.has(t.id) ? { ...t, invoiceId: inv.id } : t);
    setStore(s => ({ ...s, invoices: [...s.invoices, inv], tasks: updatedTasks }));
    toast(statusVal === 'sent' ? 'Facture créée et envoyée' : 'Brouillon enregistré');
    navigate({ page: 'billing' });
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => step === 1 ? navigate({ page: 'billing' }) : setStep(step - 1)}><I name="chevron-left" size={16}/></button>
        <div className="topbar-title">Nouvelle facture</div>
        <div className="xs muted">{step}/3</div>
      </div>

      <div className="scroll">
        <div style={{ padding: '0 14px 14px' }}>
          <div className="pbar"><span style={{ width: `${(step / 3) * 100}%` }}></span></div>
        </div>

        {step === 1 && (
          <div className="stack">
            <div><div className="big-title" style={{ fontSize: 22 }}>Choisis un client</div><div className="big-sub">Et le type de facture</div></div>
            <div className="seg">
              <button className={kind === 'standard' ? 'active' : ''} onClick={() => setKind('standard')}>Facture</button>
              <button className={kind === 'deposit' ? 'active' : ''} onClick={() => setKind('deposit')}>Acompte</button>
            </div>
            <div className="col gap-8">
              {store.clients.filter(c => !c.archived).map(c => (
                <div key={c.id} className="card card-tight" onClick={() => { setClientId(c.id); setStep(2); }}>
                  <div className="row gap-10">
                    <div className="av av-sm" style={{ background: c.color }}>{initials(`${c.firstName} ${c.lastName}`)}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong small truncate">{c.company}</div>
                      <div className="xs muted">{c.billingType === 'daily' ? `${c.rate} €/j` : c.billingType === 'hourly' ? `${c.rate} €/h` : 'Forfait'}</div>
                    </div>
                    <I name="chevron-right" size={14} className="muted"/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && client && (
          <div className="stack">
            <div className="row gap-10">
              <div className="av av-sm" style={{ background: client.color }}>{initials(`${client.firstName} ${client.lastName}`)}</div>
              <div className="grow"><div className="strong small">{client.company}</div><div className="xs muted">{kind === 'deposit' ? 'Facture d\'acompte' : 'Facture standard'}</div></div>
            </div>

            {kind === 'deposit' ? (
              <>
                <div className="card">
                  <div className="card-title">Montant de l'acompte</div>
                  <div className="field">
                    <label className="field-label">Montant (€)</label>
                    <input className="input" type="number" value={depositAmount} onChange={e => setDepositAmount(+e.target.value)}/>
                    {client.deposit && <div className="xs muted" style={{ marginTop: 4 }}>Suggéré : {fmtEUR(client.deposit)} (30%)</div>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div><div className="big-title" style={{ fontSize: 18 }}>Sélectionne les tasks</div><div className="big-sub">{availableTasks.length} disponibles · {selectedTasks.size} sélectionnée{selectedTasks.size > 1 ? 's' : ''}</div></div>
                {availableTasks.length === 0 ? (
                  <div className="empty"><div className="empty-title">Aucune task à facturer</div><div>Marque des tasks comme "Pending Invoice" sur Linear</div></div>
                ) : (
                  <div className="col gap-8">
                    {availableTasks.map(t => (
                      <div key={t.id} className={'task-item' + (selectedTasks.has(t.id) ? ' selected' : '')} onClick={() => setSelectedTasks(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })}>
                        <div className="row gap-8">
                          <div className={'checkbox-circle' + (selectedTasks.has(t.id) ? ' checked' : '')}>{selectedTasks.has(t.id) && <I name="check" size={12}/>}</div>
                          <span className="task-id">{t.linearId}</span>
                          <span className={'pill no-dot ' + (t.status === 'done' ? 'pill-done' : 'pill-pending')} style={{ marginLeft: 'auto' }}>{t.status === 'done' ? 'Done' : 'À facturer'}</span>
                        </div>
                        <div className="task-title">{t.title}</div>
                        <div className="task-meta"><span>{t.estimate}j</span><span>·</span><span className="num">{fmtEUR(t.estimate * (client.rate || 500))}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 3 && client && (
          <div className="stack">
            <div><div className="big-title" style={{ fontSize: 22 }}>Récapitulatif</div><div className="big-sub">Vérifie avant de créer</div></div>
            <div className="builder-summary">
              <div className="row gap-10" style={{ marginBottom: 14 }}>
                <div className="av" style={{ background: client.color }}>{initials(`${client.firstName} ${client.lastName}`)}</div>
                <div className="grow"><div className="strong">{client.company}</div><div className="xs muted">{client.firstName} {client.lastName}</div></div>
                {kind === 'deposit' && <span className="pill no-dot pill-deposit">Acompte</span>}
              </div>
              <div className="col gap-6" style={{ marginBottom: 14 }}>
                {lines.map((li, i) => (
                  <div key={i} className="builder-line">
                    <div style={{ minWidth: 0 }}>
                      <div className="small truncate">{li.label}</div>
                      <div className="xs muted mono">{li.qty} × {fmtEUR(li.rate)}</div>
                    </div>
                    <div className="num strong">{fmtEUR(li.qty * li.rate)}</div>
                  </div>
                ))}
              </div>
              <div className="divider"></div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="strong">Total</span>
                <span className="num strong" style={{ fontSize: 22, color: 'var(--accent)' }}>{fmtEUR(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky-cta">
        {step === 1 && <button className="btn btn-secondary grow" onClick={() => navigate({ page: 'billing' })}>Annuler</button>}
        {step === 2 && (
          <>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Retour</button>
            <button className="btn btn-primary grow" disabled={kind === 'deposit' ? !depositAmount : selectedTasks.size === 0} onClick={() => setStep(3)}>Continuer · {fmtEUR(total)}</button>
          </>
        )}
        {step === 3 && (
          <>
            <button className="btn btn-secondary" onClick={() => create('draft')}>Brouillon</button>
            <button className="btn btn-primary grow" onClick={() => create('sent')}><I name="send" size={13}/>Créer & envoyer</button>
          </>
        )}
      </div>
    </div>
  );
}

// =========================================================
// Analytics
// =========================================================
function PageAnalytics({ store, navigate }) {
  const { fmtEUR, initials } = window.FM;
  const today = new Date('2026-04-30');
  const paid = store.invoices.filter(i => i.status === 'paid');
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const v = paid.filter(inv => { const d = new Date(inv.paidDate); return d >= start && d < end; }).reduce((s, i) => s + i.total, 0);
    months.push({ label: start.toLocaleDateString('fr-FR', { month: 'short' }), value: v || (2000 + Math.round(Math.random() * 5000)) });
  }
  const total = months.reduce((s, m) => s + m.value, 0);

  const byClient = store.clients.map(c => ({ client: c, revenue: paid.filter(i => i.clientId === c.id).reduce((s, i) => s + i.total, 0) || (Math.random() * 8000) })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const maxClient = byClient[0]?.revenue || 1;

  const byType = ['daily','fixed','hourly'].map(t => {
    const cs = store.clients.filter(c => c.billingType === t).map(c => c.id);
    const r = byClient.filter(x => cs.includes(x.client.id)).reduce((s, x) => s + x.revenue, 0);
    return { type: t, revenue: r };
  });
  const totalType = byType.reduce((s, x) => s + x.revenue, 0) || 1;

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate({ page: 'dashboard' })}><I name="chevron-left" size={16}/></button>
        <div className="topbar-title">Analytics</div>
        <button className="topbar-action"><I name="download" size={15}/></button>
      </div>
      <div className="scroll">
        <div className="big-header">
          <div className="big-title">Performances</div>
          <div className="big-sub">6 derniers mois</div>
        </div>
        <div className="stack">
          <div className="card" style={{ background: 'linear-gradient(180deg, var(--bg-1), var(--bg-2))' }}>
            <div className="card-title">Revenu cumulé</div>
            <div className="num strong" style={{ fontSize: 32 }}>{fmtEUR(total)}</div>
            <div className="row gap-4 xs" style={{ color: 'var(--accent)', marginTop: 4 }}><I name="arrow-up" size={10}/>+24% sur la période</div>
            <div style={{ marginTop: 14 }}><BarChart months={months.map((m,i) => ({ ...m, isCurrent: i === months.length - 1 }))}/></div>
          </div>

          <div className="card">
            <div className="card-title">Top clients</div>
            <div className="col gap-8">
              {byClient.map((x, i) => (
                <div key={x.client.id} className="row gap-8">
                  <div className="av av-sm" style={{ background: x.client.color }}>{initials(`${x.client.firstName} ${x.client.lastName}`)}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{x.client.company}</div>
                    <div className="pbar" style={{ marginTop: 4 }}><span style={{ width: `${(x.revenue / maxClient) * 100}%`, background: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--info)' : 'var(--purple)' }}></span></div>
                  </div>
                  <div className="num strong small" style={{ minWidth: 70, textAlign: 'right' }}>{fmtEUR(x.revenue)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Mix par type</div>
            <div className="col gap-6">
              {byType.map((b, i) => (
                <div key={b.type} className="donut-row">
                  <span className="legend-dot" style={{ background: ['var(--accent)','var(--purple)','oklch(0.78 0.13 180)'][i] }}></span>
                  <div>
                    <div className="small">{b.type === 'daily' ? 'TJM' : b.type === 'fixed' ? 'Forfait' : 'Horaire'}</div>
                    <div className="pbar" style={{ marginTop: 4 }}><span style={{ width: `${(b.revenue / totalType) * 100}%`, background: ['var(--accent)','var(--purple)','oklch(0.78 0.13 180)'][i] }}></span></div>
                  </div>
                  <div className="num strong small">{Math.round((b.revenue / totalType) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Métriques clés</div>
            <div className="col gap-8">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Délai moyen paiement</span><span className="num strong">18 j</span></div>
              <div className="divider" style={{ margin: 0 }}></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Panier moyen</span><span className="num strong">{fmtEUR(Math.round(total / Math.max(paid.length, 1)))}</span></div>
              <div className="divider" style={{ margin: 0 }}></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">Run-rate annuel</span><span className="num strong" style={{ color: 'var(--accent)' }}>{fmtEUR(Math.round(total / 6 * 12))}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// More page
// =========================================================
function PageMore({ navigate, onLogout }) {
  const me = window.FM.Store.me;
  const items = [
    { id: 'projects', icon: 'folder', label: 'Projets' },
    { id: 'analytics', icon: 'chart', label: 'Analytics' },
    { id: 'settings', icon: 'settings', label: 'Réglages' },
  ];
  return (
    <div className="screen">
      <div className="topbar"><div className="topbar-title">Plus</div></div>
      <div className="scroll">
        <div className="stack">
          <div className="card" style={{ padding: 16 }}>
            <div className="row gap-12">
              <div className="av av-lg" style={{ background: 'linear-gradient(135deg, oklch(0.55 0.12 250), oklch(0.55 0.18 320))' }}>{window.FM.initials(me.name)}</div>
              <div className="grow"><div className="strong">{me.name}</div><div className="xs muted">{me.email}</div></div>
            </div>
          </div>

          <div className="list-group">
            {items.map((it, i) => (
              <div key={it.id} className="list-row" onClick={() => navigate({ page: it.id })} style={i === items.length - 1 ? { borderBottom: 'none' } : {}}>
                <div className="av av-sm" style={{ background: 'var(--bg-3)' }}><I name={it.icon} size={14} style={{ color: 'var(--text-1)' }}/></div>
                <span className="grow small">{it.label}</span>
                <I name="chevron-right" size={14} className="muted"/>
              </div>
            ))}
          </div>

          <div className="list-group">
            <div className="list-row" style={{ borderBottom: 'none' }} onClick={onLogout}>
              <div className="av av-sm" style={{ background: 'var(--danger-soft)' }}><I name="logout" size={14} style={{ color: 'var(--danger)' }}/></div>
              <span className="grow small" style={{ color: 'var(--danger)' }}>Déconnexion</span>
            </div>
          </div>

          <div className="xs muted" style={{ textAlign: 'center', padding: '20px 0' }}>FreelanceManager v0.4 · perso</div>
        </div>
      </div>
    </div>
  );
}

function PageSettings({ navigate }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => navigate({ page: 'more' })}><I name="chevron-left" size={16}/></button>
        <div className="topbar-title">Réglages</div>
      </div>
      <div className="scroll">
        <div className="stack">
          <div className="list-group">
            <div className="list-row"><I name="link" size={16} className="muted"/><div className="grow"><div className="small">Linear API</div><div className="xs muted">Connecté</div></div><I name="chevron-right" size={14} className="muted"/></div>
            <div className="list-row" style={{ borderBottom: 'none' }}><I name="bell" size={16} className="muted"/><div className="grow small">Notifications</div><I name="chevron-right" size={14} className="muted"/></div>
          </div>
          <div className="list-group">
            <div className="list-row"><I name="euro" size={16} className="muted"/><div className="grow"><div className="small">Devise</div><div className="xs muted">EUR</div></div></div>
            <div className="list-row" style={{ borderBottom: 'none' }}><I name="calendar" size={16} className="muted"/><div className="grow"><div className="small">Langue</div><div className="xs muted">Français</div></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// App root
// =========================================================
function App() {
  const [store, setStore] = useState(window.FM.Store);
  const [route, setRoute] = useState({ page: 'login' });
  const [authed, setAuthed] = useState(false);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  const navigate = (r) => {
    if (!authed && r.page !== 'login' && r.page !== 'register') setAuthed(true);
    setRoute(r);
  };
  const switchTo = (p) => setRoute({ page: p });
  const logout = () => { setAuthed(false); setRoute({ page: 'login' }); };

  let content = null;
  let showNav = false;
  if (route.page === 'login') content = <PageLogin navigate={navigate} switchTo={switchTo}/>;
  else if (route.page === 'register') content = <PageRegister navigate={navigate} switchTo={switchTo}/>;
  else {
    showNav = ['dashboard','tasks','billing','clients','more'].includes(route.page);
    switch (route.page) {
      case 'dashboard': content = <PageDashboard store={store} navigate={navigate}/>; break;
      case 'tasks': content = <PageTasks store={store} setStore={setStore} navigate={navigate} route={route}/>; break;
      case 'billing': content = <PageBilling store={store} setStore={setStore} navigate={navigate} route={route}/>; break;
      case 'clients': content = <PageClients store={store} setStore={setStore} navigate={navigate}/>; break;
      case 'client-detail': content = <PageClientDetail store={store} navigate={navigate} route={route}/>; break;
      case 'projects': content = <PageProjects store={store} navigate={navigate}/>; break;
      case 'invoice-new': content = <PageInvoiceNew store={store} setStore={setStore} navigate={navigate} route={route}/>; break;
      case 'analytics': content = <PageAnalytics store={store} navigate={navigate}/>; break;
      case 'settings': content = <PageSettings navigate={navigate}/>; break;
      case 'more': content = <PageMore navigate={navigate} onLogout={logout}/>; break;
      default: content = <div className="empty">Page non trouvée</div>;
    }
  }

  return (
    <Toaster.Provider value={pushToast}>
      <div className="stage">
        <div className="device" data-screen-label={'00 ' + route.page}>
          <div className="island"></div>
          <StatusBar/>
          <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0 }}>
            {content}
          </div>
          {showNav && <BottomNav tab={route.page} navigate={navigate}/>}
          <div className="toasts">
            {toasts.map(t => <div key={t.id} className="toast success"><I name="check" size={14} style={{ color: 'var(--accent)' }}/><span>{t.msg}</span></div>)}
          </div>
          <div className="home-indicator"></div>
        </div>
      </div>
    </Toaster.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
