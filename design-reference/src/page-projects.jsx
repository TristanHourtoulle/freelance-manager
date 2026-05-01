// Projects page
function PageProjects({ navigate, store }) {
  const { fmtEUR } = window.FM;
  const [search, setSearch] = useState('');

  const enriched = store.projects.map(p => {
    const client = store.clients.find(c => c.id === p.clientId);
    const tasks = store.tasks.filter(t => t.projectId === p.id);
    const pendingTasks = tasks.filter(t => t.status === 'pending_invoice');
    const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'pending_invoice');
    let revenue = 0, pipeline = 0;
    if (client?.billingType === 'daily') {
      pipeline = pendingTasks.reduce((s, t) => s + (t.estimate || 0) * client.rate, 0);
    } else if (client?.billingType === 'hourly') {
      pipeline = pendingTasks.reduce((s, t) => s + (t.estimate || 0) * 8 * client.rate, 0);
    }
    revenue = store.invoices.filter(i => i.projectId === p.id && i.status === 'paid').reduce((s, i) => s + i.total, 0);
    return { ...p, client, tasks, pendingTasks, doneTasks, revenue, pipeline };
  });

  const filtered = enriched.filter(p => {
    if (!search) return true;
    return (`${p.name} ${p.client?.company || ''}`).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projets</h1>
          <div className="page-sub">{enriched.length} projets · synchronisés depuis Linear</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><I name="sync" size={14} />Sync Linear</button>
          <button className="btn btn-primary"><I name="link" size={14} />Lier projet Linear</button>
        </div>
      </div>

      <div className="row gap-12" style={{ marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <I name="search" size={14} className="muted" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder="Rechercher projet…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th style={{ paddingLeft: 20 }}>Projet</th>
            <th>Client</th>
            <th>Linear</th>
            <th>Tasks</th>
            <th>À facturer</th>
            <th className="right">Pipeline</th>
            <th className="right" style={{ paddingRight: 20 }}>Revenu</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate({ page: 'tasks', projectId: p.id })}>
                <td style={{ paddingLeft: 20 }}>
                  <div className="row gap-10">
                    <div style={{ width: 32, height: 32, background: 'var(--bg-3)', borderRadius: 7, display: 'grid', placeItems: 'center' }}><I name="folder" size={14} /></div>
                    <div><div className="strong">{p.name}</div><div className="muted xs">{p.desc}</div></div>
                  </div>
                </td>
                <td>
                  {p.client && <div className="row gap-8">
                    <div className="av av-sm" style={{ background: p.client.color }}>{window.FM.initials(`${p.client.firstName} ${p.client.lastName}`)}</div>
                    <span className="small">{p.client.company}</span>
                  </div>}
                </td>
                <td><span className="task-id">{p.key}</span></td>
                <td className="num small">
                  <div className="row gap-8">
                    <span>{p.tasks.length} total</span>
                    <span className="muted">·</span>
                    <span className="muted">{p.doneTasks.length} done</span>
                  </div>
                </td>
                <td className="num">{p.pendingTasks.length > 0 ? <span className="pill pill-pending xs">{p.pendingTasks.length}</span> : <span className="muted">—</span>}</td>
                <td className="right num" style={{ color: p.pipeline > 0 ? 'var(--info)' : undefined }}>{p.pipeline > 0 ? fmtEUR(p.pipeline) : '—'}</td>
                <td className="right num strong" style={{ paddingRight: 20, color: p.revenue > 0 ? 'var(--accent)' : undefined }}>{p.revenue > 0 ? fmtEUR(p.revenue) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.PageProjects = PageProjects;
