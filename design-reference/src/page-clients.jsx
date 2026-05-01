// Clients list page
function PageClients({ navigate, store, setStore, toast }) {
  const { fmtEUR, initials, avatarColor } = window.FM;
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [showNew, setShowNew] = useState(false);

  const enriched = store.clients.filter(c => !c.archived).map(c => {
    const projects = store.projects.filter(p => p.clientId === c.id);
    const tasks = store.tasks.filter(t => t.clientId === c.id);
    const invoices = store.invoices.filter(i => i.clientId === c.id);
    const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);
    return { ...c, projects, tasks, invoices, revenue, outstanding };
  });

  const filtered = enriched.filter(c => {
    if (search && !(`${c.firstName} ${c.lastName} ${c.company}`).toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'daily' && c.billingType !== 'daily') return false;
    if (filter === 'fixed' && c.billingType !== 'fixed') return false;
    if (filter === 'hourly' && c.billingType !== 'hourly') return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <div className="page-sub">{enriched.length} clients actifs · {fmtEUR(enriched.reduce((s, c) => s + c.revenue, 0))} de revenus cumulés</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><I name="plus" size={14} />Nouveau client</button>
        </div>
      </div>

      <div className="row gap-12" style={{ marginBottom: 18, justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <I name="search" size={14} className="muted" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder="Rechercher par nom ou entreprise…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="chip-row">
          {[
            { id: 'all', label: 'Tous', count: enriched.length },
            { id: 'daily', label: 'TJM', count: enriched.filter(c => c.billingType === 'daily').length },
            { id: 'fixed', label: 'Forfait', count: enriched.filter(c => c.billingType === 'fixed').length },
            { id: 'hourly', label: 'Horaire', count: enriched.filter(c => c.billingType === 'hourly').length },
          ].map(f => (
            <button key={f.id} className={'chip' + (filter === f.id ? ' active' : '')} onClick={() => setFilter(f.id)}>
              {f.label} <span className="count">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="row gap-4" style={{ background: 'var(--bg-1)', borderRadius: 7, padding: 3, border: '1px solid var(--border)' }}>
          <button className={'icon-btn' + (view === 'grid' ? ' active' : '')} style={view === 'grid' ? { background: 'var(--bg-3)', color: 'var(--text-0)' } : {}} onClick={() => setView('grid')}><I name="grid" size={14} /></button>
          <button className={'icon-btn' + (view === 'list' ? ' active' : '')} style={view === 'list' ? { background: 'var(--bg-3)', color: 'var(--text-0)' } : {}} onClick={() => setView('list')}><I name="list" size={14} /></button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="client-grid">
          {filtered.map(c => (
            <div key={c.id} className="client-card" onClick={() => navigate({ page: 'client-detail', clientId: c.id })}>
              <div className="row gap-12">
                <div className="av av-lg" style={{ background: c.color }}>{initials(`${c.firstName} ${c.lastName}`)}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong truncate">{c.firstName} {c.lastName}</div>
                  <div className="muted small truncate">{c.company}</div>
                </div>
                <BillingTypePill type={c.billingType} />
              </div>
              <div className="client-stats">
                <div className="client-stat">
                  <div className="client-stat-label">Taux</div>
                  <div className="client-stat-value">
                    {c.billingType === 'daily' && `${c.rate}€/j`}
                    {c.billingType === 'hourly' && `${c.rate}€/h`}
                    {c.billingType === 'fixed' && fmtEUR(c.fixedPrice)}
                  </div>
                </div>
                <div className="client-stat">
                  <div className="client-stat-label">Revenu</div>
                  <div className="client-stat-value">{c.revenue ? fmtEUR(c.revenue) : '—'}</div>
                </div>
                <div className="client-stat">
                  <div className="client-stat-label">Encours</div>
                  <div className="client-stat-value" style={{ color: c.outstanding > 0 ? 'var(--warn)' : undefined }}>{c.outstanding ? fmtEUR(c.outstanding) : '—'}</div>
                </div>
              </div>
              <div className="row gap-8" style={{ marginTop: 14, justifyContent: 'space-between' }}>
                <div className="row gap-4 xs muted">
                  <I name="folder" size={11} />{c.projects.length} projet{c.projects.length > 1 ? 's' : ''}
                  <span style={{ width: 3, height: 3, background: 'currentColor', borderRadius: 99, opacity: 0.4 }}></span>
                  <I name="check-square" size={11} />{c.tasks.filter(t => t.status === 'pending_invoice').length} à facturer
                </div>
                <I name="arrow-right" size={14} className="muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr>
              <th style={{ paddingLeft: 20 }}>Client</th>
              <th>Type</th>
              <th>Taux</th>
              <th>Projets</th>
              <th>Pending</th>
              <th className="right">Revenu</th>
              <th className="right" style={{ paddingRight: 20 }}>Encours</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate({ page: 'client-detail', clientId: c.id })}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-10">
                      <div className="av" style={{ background: c.color }}>{initials(`${c.firstName} ${c.lastName}`)}</div>
                      <div><div className="strong">{c.firstName} {c.lastName}</div><div className="muted xs">{c.company}</div></div>
                    </div>
                  </td>
                  <td><BillingTypePill type={c.billingType} /></td>
                  <td className="num">{c.billingType === 'daily' ? `${c.rate}€/j` : c.billingType === 'hourly' ? `${c.rate}€/h` : fmtEUR(c.fixedPrice)}</td>
                  <td className="num">{c.projects.length}</td>
                  <td className="num muted">{c.tasks.filter(t => t.status === 'pending_invoice').length}</td>
                  <td className="right num strong">{c.revenue ? fmtEUR(c.revenue) : '—'}</td>
                  <td className="right num" style={{ paddingRight: 20, color: c.outstanding > 0 ? 'var(--warn)' : undefined }}>{c.outstanding ? fmtEUR(c.outstanding) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewClientModal onClose={() => setShowNew(false)} onCreate={(c) => {
        setStore(s => ({ ...s, clients: [...s.clients, c] }));
        toast(`${c.firstName} ${c.lastName} ajouté`);
        setShowNew(false);
      }} />}
    </div>
  );
}

function NewClientModal({ onClose, onCreate }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [billingType, setBillingType] = useState('daily');
  const [rate, setRate] = useState(500);
  const [fixedPrice, setFixedPrice] = useState(5000);
  const [deposit, setDeposit] = useState(0);

  const submit = () => {
    if (!firstName || !lastName) return;
    const id = 'c' + Math.random().toString(36).slice(2, 7);
    const client = {
      id, firstName, lastName, company, email,
      billingType,
      rate: (billingType === 'daily' || billingType === 'hourly') ? Number(rate) : null,
      fixedPrice: billingType === 'fixed' ? Number(fixedPrice) : null,
      deposit: billingType === 'fixed' && deposit > 0 ? Number(deposit) : null,
      tag: 'Freelance',
      color: window.FM.avatarColor(firstName + lastName),
      archived: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    onCreate(client);
  };

  return (
    <Modal title="Nouveau client" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!firstName || !lastName} onClick={submit}>Créer le client</button>
      </>}>
      <div className="row gap-12">
        <div className="field grow"><label className="field-label">Prénom</label><input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Henri" /></div>
        <div className="field grow"><label className="field-label">Nom</label><input className="input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Mistral" /></div>
      </div>
      <div className="field"><label className="field-label">Entreprise</label><input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Quintyss Limited" /></div>
      <div className="field"><label className="field-label">Email</label><input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@entreprise.com" /></div>

      <div className="field">
        <label className="field-label">Type de facturation</label>
        <div className="row gap-8">
          {[
            { id: 'daily', label: 'TJM', desc: 'Au jour' },
            { id: 'hourly', label: 'Horaire', desc: 'À l\'heure' },
            { id: 'fixed', label: 'Forfait', desc: 'Au projet' },
          ].map(t => (
            <button key={t.id} className={'btn btn-secondary'} style={{ flex: 1, padding: '10px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 2, borderColor: billingType === t.id ? 'var(--accent)' : 'var(--border)', background: billingType === t.id ? 'var(--accent-soft)' : 'var(--bg-2)' }} onClick={() => setBillingType(t.id)}>
              <span className="strong" style={{ color: billingType === t.id ? 'var(--accent)' : 'var(--text-0)' }}>{t.label}</span>
              <span className="xs muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {billingType !== 'fixed' && (
        <div className="field">
          <label className="field-label">Taux ({billingType === 'daily' ? '€/jour' : '€/heure'})</label>
          <input className="input num" type="number" value={rate} onChange={e => setRate(e.target.value)} />
        </div>
      )}
      {billingType === 'fixed' && (
        <>
          <div className="field"><label className="field-label">Prix du projet (€)</label><input className="input num" type="number" value={fixedPrice} onChange={e => setFixedPrice(e.target.value)} /></div>
          <div className="field"><label className="field-label">Acompte (€) <span className="muted xs">— optionnel, créera une facture distincte</span></label><input className="input num" type="number" value={deposit} onChange={e => setDeposit(e.target.value)} /></div>
        </>
      )}
    </Modal>
  );
}

window.PageClients = PageClients;
