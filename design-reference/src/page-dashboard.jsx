// Dashboard page
function PageDashboard({ navigate, store }) {
  const { fmtEUR, fmtDate, fmtRelative } = window.FM;

  // Compute KPIs
  const today = new Date('2026-04-30');
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const paidInvoices = store.invoices.filter(i => i.status === 'paid');
  const sentInvoices = store.invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdueInvoices = store.invoices.filter(i => i.status === 'overdue');

  const revenueMonth = paidInvoices.filter(i => new Date(i.paidDate) >= monthStart).reduce((s, i) => s + i.total, 0);
  const revenueYear = paidInvoices.filter(i => new Date(i.paidDate) >= yearStart).reduce((s, i) => s + i.total, 0);
  const outstanding = sentInvoices.reduce((s, i) => s + i.total, 0);
  const overdueAmount = overdueInvoices.reduce((s, i) => s + i.total, 0);

  // Pipeline: tasks status pending_invoice, value depends on client billing type
  const pipelineTasks = store.tasks.filter(t => t.status === 'pending_invoice');
  const pipeline = pipelineTasks.reduce((s, t) => {
    const client = store.clients.find(c => c.id === t.clientId);
    if (!client) return s;
    if (client.billingType === 'daily') return s + (t.estimate || 0) * (client.rate || 0);
    if (client.billingType === 'hourly') return s + (t.estimate || 0) * 8 * (client.rate || 0);
    return s; // fixed handled separately
  }, 0);

  // Monthly revenue for chart (last 8 months)
  const months = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const total = paidInvoices.filter(inv => {
      const dd = new Date(inv.paidDate);
      return dd >= d && dd < next;
    }).reduce((s, inv) => s + inv.total, 0);
    months.push({ month: d.toLocaleDateString('fr-FR', { month: 'short' }), total, isCurrent: i === 0 });
  }
  // ensure some signal
  if (months.every(m => m.total === 0)) {
    [3200, 4800, 5600, 4100, 7200, 6800, 8400, revenueMonth].forEach((v, i) => months[i].total = months[i].total || v);
  }
  const maxMonth = Math.max(...months.map(m => m.total), 1);

  // Recent activity
  const recentInvoices = [...store.invoices].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')).slice(0, 5);
  const recentTasks = store.tasks.filter(t => t.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 6);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-sub">Vue d'ensemble · {fmtDate(today.toISOString())}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate({ page: 'tasks' })}>
            <I name="check-square" size={14} />Voir tasks
          </button>
          <button className="btn btn-primary" onClick={() => navigate({ page: 'invoice-new' })}>
            <I name="plus" size={14} />Nouvelle facture
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi kpi-accent">
          <div className="kpi-label"><I name="euro" size={11} />Revenu · ce mois</div>
          <div className="kpi-value">{fmtEUR(revenueMonth)}</div>
          <div className="kpi-sub">
            <span className="kpi-trend up"><I name="arrow-up" size={10} />+18%</span>
            <span>vs mois dernier</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><I name="chart" size={11} />Revenu · {today.getFullYear()}</div>
          <div className="kpi-value">{fmtEUR(revenueYear)}</div>
          <div className="kpi-sub">
            <span>{paidInvoices.length} factures payées</span>
          </div>
        </div>
        <div className="kpi kpi-info">
          <div className="kpi-label"><I name="clock" size={11} />Pipeline</div>
          <div className="kpi-value">{fmtEUR(pipeline)}</div>
          <div className="kpi-sub">
            <span>{pipelineTasks.length} tasks à facturer</span>
          </div>
        </div>
        <div className="kpi kpi-warn">
          <div className="kpi-label"><I name="send" size={11} />Encours</div>
          <div className="kpi-value">{fmtEUR(outstanding)}</div>
          <div className="kpi-sub">
            <span>{sentInvoices.length} factures envoyées</span>
            {overdueAmount > 0 && (
              <span className="kpi-trend down" style={{ marginLeft: 'auto' }}>
                <I name="alert" size={10} />{fmtEUR(overdueAmount)} en retard
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart + alerts */}
      <div className="chart-grid">
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="card-h2">Évolution mensuelle</div>
              <div className="muted small" style={{ marginTop: 4 }}>Revenus payés · 8 derniers mois</div>
            </div>
            <div className="row gap-12">
              <div className="row gap-4 small muted"><span style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: 99 }}></span>Payé</div>
            </div>
          </div>
          <RevenueChart months={months} />
        </div>

        <div className="chart-card">
          <div className="card-h2" style={{ marginBottom: 16 }}>Alertes</div>
          <div className="col gap-12">
            {overdueInvoices.length === 0
              ? <div className="muted small" style={{ padding: '16px 0' }}>Aucune alerte ✦ tout est sous contrôle</div>
              : overdueInvoices.map(inv => {
                const client = store.clients.find(c => c.id === inv.clientId);
                const daysLate = Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={inv.id} className="row gap-12" style={{ padding: 12, background: 'var(--danger-soft)', borderRadius: 8, border: '1px solid oklch(0.70 0.20 25 / 0.3)' }}>
                    <I name="alert" size={16} style={{ color: 'var(--danger)' }} />
                    <div className="grow">
                      <div className="strong small">{inv.number} · {client?.company}</div>
                      <div className="xs muted">Échue il y a {daysLate}j · {fmtEUR(inv.total)}</div>
                    </div>
                    <button className="btn btn-sm btn-secondary"><I name="mail" size={12} />Relancer</button>
                  </div>
                );
              })
            }
            {pipeline > 5000 && (
              <div className="row gap-12" style={{ padding: 12, background: 'var(--accent-soft)', borderRadius: 8 }}>
                <I name="info" size={16} style={{ color: 'var(--accent)' }} />
                <div className="grow">
                  <div className="strong small">Pipeline conséquente</div>
                  <div className="xs muted">{pipelineTasks.length} tasks à facturer · {fmtEUR(pipeline)}</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => navigate({ page: 'invoice-new' })}>Facturer</button>
              </div>
            )}
            <div className="row gap-12" style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 8 }}>
              <I name="sync" size={16} className="muted" />
              <div className="grow">
                <div className="small">Dernière sync Linear</div>
                <div className="xs muted">{fmtRelative(store.lastSync)} · {store.tasks.length} tasks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two columns: recent invoices + recent done tasks */}
      <div className="chart-grid">
        <div className="chart-card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
            <div className="card-h2">Factures récentes</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'billing' })}>Tout voir <I name="arrow-right" size={12} /></button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 22 }}>Numéro</th>
                <th>Client</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="right" style={{ paddingRight: 22 }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map(inv => {
                const client = store.clients.find(c => c.id === inv.clientId);
                return (
                  <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate({ page: 'billing', invoiceId: inv.id })}>
                    <td style={{ paddingLeft: 22 }}><span className="mono small">{inv.number}</span>{inv.kind === 'deposit' && <span className="pill pill-deposit pill-no-dot" style={{ marginLeft: 8, fontSize: 10 }}>acompte</span>}</td>
                    <td>{client?.company}</td>
                    <td className="muted small">{fmtDate(inv.issueDate)}</td>
                    <td><StatusPill status={inv.status} /></td>
                    <td className="right num strong" style={{ paddingRight: 22 }}>{fmtEUR(inv.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="card-h2">Tasks récemment terminées</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'tasks' })}><I name="arrow-right" size={12} /></button>
          </div>
          <div className="col gap-8">
            {recentTasks.map(t => {
              const project = store.projects.find(p => p.id === t.projectId);
              return (
                <div key={t.id} className="row gap-12" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="task-id mono">{t.linearId}</span>
                  <div className="grow truncate small">{t.title}</div>
                  <span className="xs muted">{project?.key}</span>
                  <StatusPill status={t.status} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ months }) {
  const max = Math.max(...months.map(m => m.total), 1000);
  const W = 600, H = 240, padL = 50, padR = 16, padT = 16, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = innerW / months.length * 0.6;
  const stepX = innerW / months.length;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((max * i) / yTicks));

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {ticks.map((t, i) => {
        const y = padT + innerH - (innerH * i) / yTicks;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="oklch(0.32 0.010 240 / 0.4)" strokeDasharray={i === 0 ? '' : '2 4'} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="oklch(0.58 0.010 240)" fontFamily="JetBrains Mono">
              {t >= 1000 ? (t / 1000).toFixed(0) + 'k' : t}
            </text>
          </g>
        );
      })}
      {months.map((m, i) => {
        const h = (m.total / max) * innerH;
        const x = padL + i * stepX + (stepX - barW) / 2;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="3"
              fill={m.isCurrent ? 'oklch(0.86 0.19 128)' : 'oklch(0.86 0.19 128 / 0.45)'} />
            <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" fontSize="11" fill="oklch(0.58 0.010 240)">{m.month}</text>
            {m.total > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="oklch(0.78 0.008 240)" fontFamily="JetBrains Mono" fontWeight="500">
                {(m.total / 1000).toFixed(1)}k
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

window.PageDashboard = PageDashboard;
