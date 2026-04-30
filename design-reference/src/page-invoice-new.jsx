// New invoice page — drag & drop tasks → invoice
function PageInvoiceNew({ navigate, store, setStore, route, toast }) {
  const { fmtEUR, fmtEURprecise } = window.FM;
  const [clientId, setClientId] = useState(route.clientId || '');
  const [projectId, setProjectId] = useState('all');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [kind, setKind] = useState('standard'); // standard | deposit
  const [depositLabel, setDepositLabel] = useState('Acompte 30%');
  const [depositAmount, setDepositAmount] = useState(0);

  // Lines: [{ taskId, label, qty, rate }]
  const [lines, setLines] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Pre-select tasks if passed
  useEffect(() => {
    if (route.preselected && clientId) {
      const c = store.clients.find(cc => cc.id === clientId);
      if (!c) return;
      const newLines = route.preselected.map(tid => {
        const t = store.tasks.find(x => x.id === tid);
        if (!t) return null;
        return makeLineFromTask(t, c);
      }).filter(Boolean);
      setLines(newLines);
    }
  }, [route.preselected, clientId]);

  const client = store.clients.find(c => c.id === clientId);

  const eligibleTasks = store.tasks.filter(t =>
    t.clientId === clientId
    && t.status === 'pending_invoice'
    && !t.invoiceId
    && !lines.some(l => l.taskId === t.id)
    && (projectId === 'all' || t.projectId === projectId)
  );

  function makeLineFromTask(t, c) {
    let qty, rate;
    if (c.billingType === 'daily') { qty = t.estimate || 1; rate = c.rate; }
    else if (c.billingType === 'hourly') { qty = (t.estimate || 1) * 8; rate = c.rate; }
    else { qty = 1; rate = 0; }
    return { id: 'L' + Math.random().toString(36).slice(2, 8), taskId: t.id, label: `[${t.linearId}] ${t.title}`, qty, rate };
  }

  const addTask = (t) => { if (!client) return; setLines([...lines, makeLineFromTask(t, client)]); };
  const removeLine = (id) => setLines(lines.filter(l => l.id !== id));
  const updateLine = (id, patch) => setLines(lines.map(l => l.id === id ? { ...l, ...patch } : l));
  const addBlank = () => setLines([...lines, { id: 'L' + Math.random().toString(36).slice(2, 8), taskId: null, label: 'Ligne personnalisée', qty: 1, rate: 0 }]);

  const subtotal = kind === 'deposit' ? Number(depositAmount) || 0 : lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);

  const submit = (status) => {
    if (!client) return;
    const num = `${new Date().getFullYear()}-${String(1024 + store.invoices.length + 1).padStart(4, '0')}`;
    const lineItems = kind === 'deposit'
      ? [{ taskId: null, label: depositLabel, qty: 1, rate: Number(depositAmount) || 0 }]
      : lines.map(l => ({ taskId: l.taskId, label: l.label, qty: Number(l.qty), rate: Number(l.rate) }));
    const invoice = {
      id: 'inv-' + Math.random().toString(36).slice(2, 8),
      number: num,
      clientId: client.id,
      projectId: projectId !== 'all' ? projectId : (store.projects.find(p => p.clientId === client.id)?.id || null),
      status,
      kind,
      issueDate, dueDate,
      paidDate: null,
      lineItems,
      subtotal,
      tax: 0,
      total: subtotal,
      notes: '',
    };
    setStore(s => ({
      ...s,
      invoices: [invoice, ...s.invoices],
      tasks: s.tasks.map(t => lineItems.some(l => l.taskId === t.id) ? { ...t, invoiceId: invoice.id } : t),
    }));
    toast(status === 'draft' ? `Brouillon ${num} créé` : `Facture ${num} créée et envoyée`);
    navigate({ page: 'billing', invoiceId: invoice.id });
  };

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate({ page: 'billing' })}><I name="chevron-left" size={12} />Factures</button>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle facture</h1>
          <div className="page-sub">Sélectionne un client puis ajoute des tasks par drag & drop ou clic</div>
        </div>
      </div>

      {/* Top: client + kind picker */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label">Client</label>
            <select className="select" value={clientId} onChange={e => { setClientId(e.target.value); setLines([]); }}>
              <option value="">— choisir un client —</option>
              {store.clients.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.company} · {c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label">Projet (optionnel)</label>
            <select className="select" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!clientId}>
              <option value="all">Tous les projets</option>
              {store.projects.filter(p => p.clientId === clientId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label">Émise le</label>
            <input className="input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label">Échéance</label>
            <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="field" style={{ width: 220 }}>
            <label className="field-label">Type</label>
            <div className="row gap-4" style={{ background: 'var(--bg-2)', borderRadius: 7, padding: 3, border: '1px solid var(--border)' }}>
              <button className="chip" style={{ flex: 1, justifyContent: 'center', background: kind === 'standard' ? 'var(--accent)' : 'transparent', color: kind === 'standard' ? 'var(--accent-text)' : 'var(--text-1)', border: 'none' }} onClick={() => setKind('standard')}>Standard</button>
              <button className="chip" style={{ flex: 1, justifyContent: 'center', background: kind === 'deposit' ? 'var(--accent)' : 'transparent', color: kind === 'deposit' ? 'var(--accent-text)' : 'var(--text-1)', border: 'none' }} onClick={() => setKind('deposit')}>Acompte</button>
            </div>
          </div>
        </div>
        {client && (
          <div className="row gap-12" style={{ marginTop: 14, padding: 12, background: 'var(--bg-2)', borderRadius: 8 }}>
            <div className="av av-sm" style={{ background: client.color }}>{window.FM.initials(`${client.firstName} ${client.lastName}`)}</div>
            <div className="grow">
              <div className="strong small">{client.firstName} {client.lastName} · {client.company}</div>
              <div className="muted xs">Type {client.billingType} · {client.billingType === 'daily' ? `${client.rate}€/j` : client.billingType === 'hourly' ? `${client.rate}€/h` : fmtEUR(client.fixedPrice)}</div>
            </div>
            <BillingTypePill type={client.billingType} />
          </div>
        )}
      </div>

      {!clientId ? (
        <div className="card"><div className="empty"><div className="empty-title">Choisis un client pour commencer</div><div>Les tasks éligibles apparaîtront à gauche, le récap de la facture à droite.</div></div></div>
      ) : kind === 'deposit' ? (
        // Deposit kind — simple form
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-h2" style={{ marginBottom: 16 }}>Détails de l'acompte</div>
          <div className="col gap-12">
            <div className="field"><label className="field-label">Description</label><input className="input" value={depositLabel} onChange={e => setDepositLabel(e.target.value)} /></div>
            <div className="field"><label className="field-label">Montant (€)</label><input className="input num" type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} /></div>
            {client.billingType === 'fixed' && (
              <div className="row gap-8 small" style={{ padding: 10, background: 'var(--info-soft)', borderRadius: 7 }}>
                <I name="info" size={14} style={{ color: 'var(--info)' }} />
                <span>Forfait projet : {fmtEUR(client.fixedPrice)}{client.deposit ? ` · acompte suggéré ${fmtEUR(client.deposit)}` : ''}</span>
                {client.deposit && <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setDepositAmount(client.deposit)}>Utiliser</button>}
              </div>
            )}
          </div>
          <div className="divider"></div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="strong">Total facture</span>
            <span className="num strong" style={{ fontSize: 22 }}>{fmtEUR(subtotal)}</span>
          </div>
          <div className="row gap-8" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => submit('draft')} disabled={!subtotal}>Sauver brouillon</button>
            <button className="btn btn-primary" onClick={() => submit('sent')} disabled={!subtotal}><I name="send" size={14} />Créer et envoyer</button>
          </div>
        </div>
      ) : (
        // Standard kind — drag & drop builder
        <div className="builder">
          <div>
            <div className="card-title" style={{ marginBottom: 10 }}>
              <span>Tasks à facturer · {eligibleTasks.length}</span>
              <span className="xs muted">Glisse-déposer ou clique pour ajouter</span>
            </div>
            {eligibleTasks.length === 0 && lines.length === 0 && (
              <div className="card"><div className="empty"><div className="empty-title">Aucune task à facturer</div><div>Ce client n'a pas de task en statut "Pending Invoice".</div></div></div>
            )}
            <div>
              {eligibleTasks.map(t => {
                const project = store.projects.find(p => p.id === t.projectId);
                const value = client.billingType === 'daily' ? (t.estimate || 0) * client.rate
                  : client.billingType === 'hourly' ? (t.estimate || 0) * 8 * client.rate : 0;
                return (
                  <div key={t.id} className="task-pickable"
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.currentTarget.classList.add('dragging'); }}
                    onDragEnd={e => e.currentTarget.classList.remove('dragging')}
                    onClick={() => addTask(t)}>
                    <I name="grip" size={14} className="muted" />
                    <div>
                      <div className="row gap-8">
                        <span className="task-id">{t.linearId}</span>
                        <span className="strong small truncate">{t.title}</span>
                      </div>
                      <div className="xs muted" style={{ marginTop: 2 }}>{project?.name} · {t.estimate}j</div>
                    </div>
                    <span className="num small">{fmtEUR(value)}</span>
                    <I name="plus" size={14} className="muted" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: invoice preview */}
          <div className="invoice-side">
            <div className="card-h2" style={{ marginBottom: 14 }}>Aperçu facture</div>

            <div className="dropzone" style={{ minHeight: lines.length === 0 ? 200 : 'auto' }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                const tid = e.dataTransfer.getData('text/plain');
                const t = store.tasks.find(x => x.id === tid);
                if (t) addTask(t);
              }}
              className={'dropzone' + (dragOver ? ' over' : '') + (lines.length === 0 ? ' empty' : '')}
            >
              {lines.length === 0 ? (
                <div>
                  <I name="plus" size={20} className="muted" /><br />
                  <div style={{ marginTop: 6 }}>Glisse une task ici<br /><span className="xs muted">ou clique sur une task à gauche</span></div>
                </div>
              ) : (
                <>
                  {lines.map(l => (
                    <div key={l.id} className="line-item">
                      <I name="grip" size={12} className="muted" />
                      <div style={{ minWidth: 0 }}>
                        <input className="input" style={{ padding: '4px 7px', fontSize: 12 }} value={l.label} onChange={e => updateLine(l.id, { label: e.target.value })} />
                      </div>
                      <div className="row gap-4">
                        <input type="number" step="0.25" value={l.qty} onChange={e => updateLine(l.id, { qty: e.target.value })} title="Quantité" />
                        <span className="muted xs">×</span>
                        <input type="number" value={l.rate} onChange={e => updateLine(l.id, { rate: e.target.value })} title="Taux" />
                      </div>
                      <button className="line-remove" onClick={() => removeLine(l.id)}><I name="x" size={12} /></button>
                    </div>
                  ))}
                </>
              )}
            </div>

            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addBlank}><I name="plus" size={12} />Ligne personnalisée</button>

            <div className="divider"></div>
            <div className="col gap-4">
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">Sous-total</span><span className="num">{fmtEURprecise(subtotal)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small">TVA (0%)</span><span className="num muted">—</span></div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span className="strong">Total</span>
                <span className="num strong" style={{ fontSize: 22 }}>{fmtEURprecise(subtotal)}</span>
              </div>
            </div>

            <div className="col gap-8" style={{ marginTop: 18 }}>
              <button className="btn btn-primary" disabled={lines.length === 0} onClick={() => submit('sent')}><I name="send" size={14} />Créer et envoyer</button>
              <button className="btn btn-secondary" disabled={lines.length === 0} onClick={() => submit('draft')}>Sauver en brouillon</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.PageInvoiceNew = PageInvoiceNew;
