// Tasks page — Linear-style synced view
function PageTasks({ navigate, store, route, toast }) {
  const { fmtEUR, fmtRelative } = window.FM;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState(route.clientId || 'all');
  const [projectFilter, setProjectFilter] = useState(route.projectId || 'all');
  const [selected, setSelected] = useState(new Set());
  const [syncing, setSyncing] = useState(false);

  const allTasks = store.tasks;

  const filtered = allTasks.filter(t => {
    if (search && !(t.linearId + ' ' + t.title).toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'pending') { if (t.status !== 'pending_invoice') return false; }
    else if (statusFilter === 'done') { if (t.status !== 'done') return false; }
    else if (statusFilter === 'in_progress') { if (t.status !== 'in_progress') return false; }
    else if (statusFilter === 'all') { if (t.status !== 'pending_invoice' && t.status !== 'done' && t.status !== 'in_progress') return false; }
    if (clientFilter !== 'all' && t.clientId !== clientFilter) return false;
    if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
    return true;
  });

  // group by client → project
  const groups = {};
  filtered.forEach(t => {
    const key = t.clientId + '::' + t.projectId;
    if (!groups[key]) groups[key] = { clientId: t.clientId, projectId: t.projectId, tasks: [] };
    groups[key].tasks.push(t);
  });
  const groupList = Object.values(groups);

  const counts = {
    all: allTasks.filter(t => ['pending_invoice', 'done', 'in_progress'].includes(t.status)).length,
    pending: allTasks.filter(t => t.status === 'pending_invoice').length,
    done: allTasks.filter(t => t.status === 'done').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
  };

  // Pipeline value of selected
  const selectedTasks = filtered.filter(t => selected.has(t.id));
  const selectedValue = selectedTasks.reduce((s, t) => {
    const c = store.clients.find(cc => cc.id === t.clientId);
    if (!c) return s;
    if (c.billingType === 'daily') return s + (t.estimate || 0) * c.rate;
    if (c.billingType === 'hourly') return s + (t.estimate || 0) * 8 * c.rate;
    return s;
  }, 0);
  const selectedClientIds = new Set(selectedTasks.map(t => t.clientId));
  const canInvoiceSelected = selectedClientIds.size === 1;

  const doSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); toast('Sync Linear terminée'); }, 1400);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="page-sub">Synchronisées depuis Linear · {counts.all} tasks visibles · dernière sync {fmtRelative(store.lastSync)}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={doSync} disabled={syncing}>
            <I name="sync" size={14} className={syncing ? 'spin' : ''} />{syncing ? 'Synchronisation…' : 'Sync Linear'}
          </button>
          {selected.size > 0 && canInvoiceSelected && (
            <button className="btn btn-primary" onClick={() => navigate({ page: 'invoice-new', clientId: [...selectedClientIds][0], preselected: [...selected] })}>
              <I name="invoice" size={14} />Facturer ({selected.size}) · {fmtEUR(selectedValue)}
            </button>
          )}
          {selected.size > 0 && !canInvoiceSelected && (
            <button className="btn btn-secondary" disabled title="Sélectionne un seul client">
              <I name="alert" size={14} />Plusieurs clients
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="row gap-12" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <I name="search" size={14} className="muted" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder="Rechercher par ID ou titre…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="chip-row">
          <button className={'chip' + (statusFilter === 'all' ? ' active' : '')} onClick={() => setStatusFilter('all')}>Tout <span className="count">{counts.all}</span></button>
          <button className={'chip' + (statusFilter === 'pending' ? ' active' : '')} onClick={() => setStatusFilter('pending')}>À facturer <span className="count">{counts.pending}</span></button>
          <button className={'chip' + (statusFilter === 'done' ? ' active' : '')} onClick={() => setStatusFilter('done')}>Done <span className="count">{counts.done}</span></button>
          <button className={'chip' + (statusFilter === 'in_progress' ? ' active' : '')} onClick={() => setStatusFilter('in_progress')}>In progress <span className="count">{counts.in_progress}</span></button>
        </div>
        <select className="select" style={{ width: 200 }} value={clientFilter} onChange={e => { setClientFilter(e.target.value); setProjectFilter('all'); }}>
          <option value="all">Tous les clients</option>
          {store.clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
        </select>
        <select className="select" style={{ width: 220 }} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="all">Tous les projets</option>
          {store.projects.filter(p => clientFilter === 'all' || p.clientId === clientFilter).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Group sections */}
      <div className="col gap-16">
        {groupList.length === 0 && <div className="card"><div className="empty"><div className="empty-title">Aucune task</div><div>Ajuste les filtres ou lance une sync</div></div></div>}
        {groupList.map(g => {
          const c = store.clients.find(cc => cc.id === g.clientId);
          const p = store.projects.find(pp => pp.id === g.projectId);
          const groupValue = g.tasks.reduce((s, t) => {
            if (!c) return s;
            if (c.billingType === 'daily') return s + (t.estimate || 0) * c.rate;
            if (c.billingType === 'hourly') return s + (t.estimate || 0) * 8 * c.rate;
            return s;
          }, 0);
          return (
            <div key={g.clientId + g.projectId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="row gap-12" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <div className="av av-sm" style={{ background: c?.color }}>{c && window.FM.initials(`${c.firstName} ${c.lastName}`)}</div>
                <div>
                  <div className="strong small">{c?.company} · <span className="muted">{p?.name}</span></div>
                  <div className="xs muted">{g.tasks.length} task{g.tasks.length > 1 ? 's' : ''} · {c && c.billingType === 'daily' ? `${c.rate}€/j` : c?.billingType === 'hourly' ? `${c.rate}€/h` : 'Forfait'}</div>
                </div>
                <div style={{ marginLeft: 'auto' }} className="num strong">{groupValue > 0 ? fmtEUR(groupValue) : '—'}</div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 18, width: 40 }}>
                      <input type="checkbox" onChange={e => {
                        const next = new Set(selected);
                        g.tasks.forEach(t => e.target.checked ? next.add(t.id) : next.delete(t.id));
                        setSelected(next);
                      }} checked={g.tasks.every(t => selected.has(t.id))} />
                    </th>
                    <th style={{ width: 88 }}>ID</th>
                    <th>Title</th>
                    <th style={{ width: 130 }}>Statut</th>
                    <th className="right" style={{ width: 90 }}>Estimate</th>
                    <th className="right" style={{ width: 110 }}>Valeur</th>
                    <th style={{ width: 110, paddingRight: 18 }}>Facturée</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tasks.map(t => {
                    const value = c?.billingType === 'daily' ? (t.estimate || 0) * c.rate
                      : c?.billingType === 'hourly' ? (t.estimate || 0) * 8 * c.rate : null;
                    const inv = t.invoiceId ? store.invoices.find(i => i.id === t.invoiceId) : null;
                    return (
                      <tr key={t.id} className={selected.has(t.id) ? 'selected' : ''} style={selected.has(t.id) ? { background: 'var(--accent-soft)' } : {}}>
                        <td style={{ paddingLeft: 18 }}>
                          <input type="checkbox" checked={selected.has(t.id)} onChange={e => {
                            const next = new Set(selected);
                            e.target.checked ? next.add(t.id) : next.delete(t.id);
                            setSelected(next);
                          }} />
                        </td>
                        <td><span className="task-id">{t.linearId}</span></td>
                        <td className="strong">{t.title}</td>
                        <td><StatusPill status={t.status} /></td>
                        <td className="right num">{t.estimate ? `${t.estimate}j` : '—'}</td>
                        <td className="right num">{value != null ? fmtEUR(value) : '—'}</td>
                        <td style={{ paddingRight: 18 }}>{inv ? <span className="mono xs muted">{inv.number}</span> : <span className="muted xs">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* selection bar */}
      {selected.size > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-1)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '10px 16px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: 14, zIndex: 20 }}>
          <span className="strong small">{selected.size} task{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</span>
          <span className="muted xs">·</span>
          <span className="num strong">{fmtEUR(selectedValue)}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}><I name="x" size={12} /> Désélectionner</button>
          {canInvoiceSelected && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate({ page: 'invoice-new', clientId: [...selectedClientIds][0], preselected: [...selected] })}>
              <I name="invoice" size={12} />Créer facture
            </button>
          )}
        </div>
      )}
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

window.PageTasks = PageTasks;
