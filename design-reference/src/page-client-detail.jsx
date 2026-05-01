// Client detail page
function PageClientDetail({ navigate, store, setStore, route }) {
  const { fmtEUR, fmtDate, initials } = window.FM;
  const client = store.clients.find(c => c.id === route.clientId);
  const [tab, setTab] = useState('overview');
  if (!client) return <div className="page"><div className="empty">Client introuvable</div></div>;

  const projects = store.projects.filter(p => p.clientId === client.id);
  const tasks = store.tasks.filter(t => t.clientId === client.id);
  const invoices = store.invoices.filter(i => i.clientId === client.id);
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
  const pendingTasks = tasks.filter(t => t.status === 'pending_invoice');
  const pipeline = pendingTasks.reduce((s, t) => {
    if (client.billingType === 'daily') return s + (t.estimate || 0) * (client.rate || 0);
    if (client.billingType === 'hourly') return s + (t.estimate || 0) * 8 * (client.rate || 0);
    return s;
  }, 0);

  return (
    <div className="page">
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'clients' })}><I name="chevron-left" size={12} />Clients</button>
      </div>

      <div className="detail-hero">
        <div className="av av-lg" style={{ background: client.color, width: 56, height: 56, fontSize: 18, borderRadius: 12 }}>{initials(`${client.firstName} ${client.lastName}`)}</div>
        <div>
          <div className="row gap-8">
            <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>{client.firstName} {client.lastName}</h1>
            <BillingTypePill type={client.billingType} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>{client.company} · {client.email}</div>
          <div className="row gap-12 small muted" style={{ marginTop: 8 }}>
            <span><I name="calendar" size={11} /> Client depuis {fmtDate(client.createdAt)}</span>
            <span><I name="briefcase" size={11} /> {projects.length} projet{projects.length > 1 ? 's' : ''}</span>
            <span><I name="invoice" size={11} /> {invoices.length} facture{invoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-label">Taux</div>
            <div className="hero-stat-value">
              {client.billingType === 'daily' && `${client.rate}€/j`}
              {client.billingType === 'hourly' && `${client.rate}€/h`}
              {client.billingType === 'fixed' && fmtEUR(client.fixedPrice)}
            </div>
          </div>
          <div>
            <div className="hero-stat-label">Revenu</div>
            <div className="hero-stat-value" style={{ color: 'var(--accent)' }}>{fmtEUR(revenue)}</div>
          </div>
          <div>
            <div className="hero-stat-label">Encours</div>
            <div className="hero-stat-value" style={{ color: outstanding > 0 ? 'var(--warn)' : undefined }}>{fmtEUR(outstanding)}</div>
          </div>
          <div>
            <div className="hero-stat-label">Pipeline</div>
            <div className="hero-stat-value" style={{ color: pipeline > 0 ? 'var(--info)' : undefined }}>{pipeline > 0 ? fmtEUR(pipeline) : '—'}</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'overview', label: 'Vue d\'ensemble' },
          { id: 'projects', label: `Projets (${projects.length})` },
          { id: 'tasks', label: `Tasks (${tasks.length})` },
          { id: 'invoices', label: `Factures (${invoices.length})` },
        ].map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
        <div style={{ marginLeft: 'auto', paddingBottom: 6 }}>
          {pendingTasks.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate({ page: 'invoice-new', clientId: client.id })}>
              <I name="plus" size={12} />Facturer ({pendingTasks.length})
            </button>
          )}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="chart-grid">
          <div className="card">
            <div className="card-h2" style={{ marginBottom: 16 }}>Projets en cours</div>
            {projects.length === 0 && <div className="muted small">Aucun projet</div>}
            <div className="col gap-12">
              {projects.map(p => {
                const ts = tasks.filter(t => t.projectId === p.id);
                const done = ts.filter(t => t.status === 'done' || t.status === 'pending_invoice').length;
                return (
                  <div key={p.id} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div className="row gap-8" style={{ marginBottom: 8 }}>
                      <I name="folder" size={14} className="muted" />
                      <div className="strong grow truncate">{p.name}</div>
                      <span className="task-id">{p.key}</span>
                    </div>
                    <div className="muted xs" style={{ marginBottom: 10 }}>{p.desc}</div>
                    <div className="row gap-8 xs muted" style={{ marginBottom: 6 }}>
                      <span>{done}/{ts.length} tasks</span>
                      <span style={{ marginLeft: 'auto' }}>{Math.round((done / Math.max(ts.length, 1)) * 100)}%</span>
                    </div>
                    <div className="pbar"><span style={{ width: `${(done / Math.max(ts.length, 1)) * 100}%` }}></span></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-h2" style={{ marginBottom: 16 }}>Dernières factures</div>
            <div className="col gap-8">
              {invoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="row gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="mono small">{inv.number}</span>
                  {inv.kind === 'deposit' && <span className="pill pill-deposit pill-no-dot xs">acompte</span>}
                  <div className="grow muted xs">{fmtDate(inv.issueDate)}</div>
                  <StatusPill status={inv.status} />
                  <span className="num strong" style={{ width: 90, textAlign: 'right' }}>{fmtEUR(inv.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="client-grid">
          {projects.map(p => {
            const ts = tasks.filter(t => t.projectId === p.id);
            return (
              <div key={p.id} className="client-card" onClick={() => navigate({ page: 'tasks', projectId: p.id })}>
                <div className="row gap-12">
                  <div style={{ width: 40, height: 40, background: 'var(--bg-3)', borderRadius: 9, display: 'grid', placeItems: 'center' }}><I name="folder" size={18} /></div>
                  <div className="grow">
                    <div className="strong">{p.name}</div>
                    <div className="muted small">{p.desc}</div>
                  </div>
                </div>
                <div className="client-stats">
                  <div className="client-stat"><div className="client-stat-label">Total</div><div className="client-stat-value">{ts.length}</div></div>
                  <div className="client-stat"><div className="client-stat-label">Done</div><div className="client-stat-value" style={{ color: 'var(--accent)' }}>{ts.filter(t => t.status === 'done' || t.status === 'pending_invoice').length}</div></div>
                  <div className="client-stat"><div className="client-stat-label">À facturer</div><div className="client-stat-value" style={{ color: 'var(--warn)' }}>{ts.filter(t => t.status === 'pending_invoice').length}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'tasks' && <TasksTable tasks={tasks} store={store} />}

      {tab === 'invoices' && <InvoicesTable invoices={invoices} store={store} navigate={navigate} />}
    </div>
  );
}

// Reusable tables
function TasksTable({ tasks, store, hideClient }) {
  const { fmtEUR, fmtDate } = window.FM;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead><tr>
          <th style={{ paddingLeft: 20 }}>ID</th>
          <th>Title</th>
          <th>Projet</th>
          {!hideClient && <th>Client</th>}
          <th>Statut</th>
          <th className="right">Estimate</th>
          <th className="right" style={{ paddingRight: 20 }}>Facturé</th>
        </tr></thead>
        <tbody>
          {tasks.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="empty-title">Aucune task</div></div></td></tr>}
          {tasks.map(t => {
            const project = store.projects.find(p => p.id === t.projectId);
            const client = store.clients.find(c => c.id === t.clientId);
            return (
              <tr key={t.id}>
                <td style={{ paddingLeft: 20 }}><span className="task-id">{t.linearId}</span></td>
                <td className="strong">{t.title}</td>
                <td className="muted small">{project?.key}</td>
                {!hideClient && <td className="muted small">{client?.company}</td>}
                <td><StatusPill status={t.status} /></td>
                <td className="right num">{t.estimate ? `${t.estimate}j` : '—'}</td>
                <td className="right small" style={{ paddingRight: 20 }}>{t.invoiceId ? <span className="pill pill-paid pill-no-dot xs">Facturée</span> : <span className="muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTable({ invoices, store, navigate }) {
  const { fmtEUR, fmtDate } = window.FM;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead><tr>
          <th style={{ paddingLeft: 20 }}>Numéro</th>
          <th>Émise</th>
          <th>Échéance</th>
          <th>Type</th>
          <th>Statut</th>
          <th className="right" style={{ paddingRight: 20 }}>Montant</th>
        </tr></thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate && navigate({ page: 'billing', invoiceId: inv.id })}>
              <td style={{ paddingLeft: 20 }}>
                <div className="row gap-8">
                  <span className="mono small strong">{inv.number}</span>
                  {inv.kind === 'deposit' && <span className="pill pill-deposit pill-no-dot xs">acompte</span>}
                </div>
                <div className="xs muted" style={{ marginTop: 2 }}>{inv.lineItems.length} ligne{inv.lineItems.length > 1 ? 's' : ''}</div>
              </td>
              <td className="muted small">{fmtDate(inv.issueDate)}</td>
              <td className="muted small">{fmtDate(inv.dueDate)}</td>
              <td className="small">{inv.kind === 'deposit' ? 'Acompte' : 'Standard'}</td>
              <td><StatusPill status={inv.status} /></td>
              <td className="right num strong" style={{ paddingRight: 20 }}>{fmtEUR(inv.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.PageClientDetail = PageClientDetail;
window.TasksTable = TasksTable;
window.InvoicesTable = InvoicesTable;
