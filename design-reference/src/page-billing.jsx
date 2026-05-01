// Billing list page + invoice detail drawer
function PageBilling({ navigate, store, setStore, route, toast }) {
  const { fmtEUR, fmtDate } = window.FM;
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(route.invoiceId || null);

  const open = openId ? store.invoices.find(i => i.id === openId) : null;

  const filtered = store.invoices.filter(i => {
    if (filter !== 'all' && i.status !== filter) return false;
    if (search) {
      const c = store.clients.find(c => c.id === i.clientId);
      const text = `${i.number} ${c?.company} ${c?.firstName} ${c?.lastName}`.toLowerCase();
      if (!text.includes(search.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));

  const counts = {
    all: store.invoices.length,
    draft: store.invoices.filter(i => i.status === 'draft').length,
    sent: store.invoices.filter(i => i.status === 'sent').length,
    paid: store.invoices.filter(i => i.status === 'paid').length,
    overdue: store.invoices.filter(i => i.status === 'overdue').length,
  };

  const totals = {
    paid: store.invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
    sent: store.invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.total, 0),
    overdue: store.invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0),
  };

  const updateStatus = (id, status, paidDate = null) => {
    setStore(s => ({
      ...s,
      invoices: s.invoices.map(inv => inv.id === id ? { ...inv, status, paidDate: paidDate ?? inv.paidDate } : inv),
    }));
    toast(status === 'paid' ? 'Facture marquée comme payée' : status === 'sent' ? 'Facture envoyée' : 'Statut mis à jour');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <div className="page-sub">{store.invoices.length} factures · {fmtEUR(totals.paid)} payées · {fmtEUR(totals.sent + totals.overdue)} en attente</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate({ page: 'invoice-new' })}><I name="plus" size={14} />Nouvelle facture</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi kpi-accent">
          <div className="kpi-label"><I name="check" size={11} />Payées</div>
          <div className="kpi-value">{fmtEUR(totals.paid)}</div>
          <div className="kpi-sub"><span>{counts.paid} factures</span></div>
        </div>
        <div className="kpi kpi-info">
          <div className="kpi-label"><I name="send" size={11} />Envoyées · en attente</div>
          <div className="kpi-value">{fmtEUR(totals.sent)}</div>
          <div className="kpi-sub"><span>{counts.sent} factures</span></div>
        </div>
        <div className="kpi kpi-warn" style={{ borderLeftColor: 'var(--danger)' }}>
          <div className="kpi-label"><I name="alert" size={11} />En retard</div>
          <div className="kpi-value" style={{ color: counts.overdue > 0 ? 'var(--danger)' : undefined }}>{fmtEUR(totals.overdue)}</div>
          <div className="kpi-sub"><span>{counts.overdue} facture{counts.overdue > 1 ? 's' : ''}</span></div>
        </div>
      </div>

      <div className="row gap-12" style={{ marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <I name="search" size={14} className="muted" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input className="input" style={{ paddingLeft: 34 }} placeholder="Rechercher facture, client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="chip-row">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'draft', label: 'Brouillon' },
            { id: 'sent', label: 'Envoyée' },
            { id: 'paid', label: 'Payée' },
            { id: 'overdue', label: 'En retard' },
          ].map(f => (
            <button key={f.id} className={'chip' + (filter === f.id ? ' active' : '')} onClick={() => setFilter(f.id)}>
              {f.label} <span className="count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr>
            <th style={{ paddingLeft: 20 }}>Numéro</th>
            <th>Client</th>
            <th>Émise</th>
            <th>Échéance</th>
            <th>Type</th>
            <th>Statut</th>
            <th className="right">Montant</th>
            <th style={{ paddingRight: 20, width: 80 }}></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="empty-title">Aucune facture</div></div></td></tr>}
            {filtered.map(inv => {
              const client = store.clients.find(c => c.id === inv.clientId);
              return (
                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(inv.id)}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-8">
                      <span className="mono small strong">{inv.number}</span>
                      {inv.kind === 'deposit' && <span className="pill pill-deposit pill-no-dot xs">acompte</span>}
                    </div>
                    <div className="xs muted" style={{ marginTop: 2 }}>{inv.lineItems.length} ligne{inv.lineItems.length > 1 ? 's' : ''}</div>
                  </td>
                  <td>
                    <div className="row gap-8">
                      <div className="av av-sm" style={{ background: client?.color }}>{client && window.FM.initials(`${client.firstName} ${client.lastName}`)}</div>
                      <span className="small">{client?.company}</span>
                    </div>
                  </td>
                  <td className="muted small">{fmtDate(inv.issueDate)}</td>
                  <td className="muted small">{fmtDate(inv.dueDate)}</td>
                  <td className="small">{inv.kind === 'deposit' ? 'Acompte' : 'Standard'}</td>
                  <td><StatusPill status={inv.status} /></td>
                  <td className="right num strong">{fmtEUR(inv.total)}</td>
                  <td style={{ paddingRight: 20 }}><I name="chevron-right" size={14} className="muted" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <InvoiceDrawer invoice={open} client={store.clients.find(c => c.id === open.clientId)} onClose={() => setOpenId(null)} updateStatus={updateStatus} />}
    </div>
  );
}

function InvoiceDrawer({ invoice, client, onClose, updateStatus }) {
  const { fmtEUR, fmtEURprecise, fmtDate } = window.FM;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="row gap-8">
              <h3 className="modal-title mono">{invoice.number}</h3>
              <StatusPill status={invoice.status} />
              {invoice.kind === 'deposit' && <span className="pill pill-deposit pill-no-dot xs">acompte</span>}
            </div>
            <div className="muted xs" style={{ marginTop: 4 }}>Émise {fmtDate(invoice.issueDate)} · échéance {fmtDate(invoice.dueDate)}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I name="x" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="row gap-12" style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 8 }}>
            <div className="av av-lg" style={{ background: client?.color }}>{client && window.FM.initials(`${client.firstName} ${client.lastName}`)}</div>
            <div>
              <div className="strong">{client?.firstName} {client?.lastName}</div>
              <div className="muted small">{client?.company}</div>
              <div className="muted xs">{client?.email}</div>
            </div>
            <BillingTypePill type={client?.billingType} />
          </div>

          <div>
            <div className="card-title">Lignes</div>
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead><tr><th style={{ paddingLeft: 14 }}>Description</th><th className="right">Qté</th><th className="right">Taux</th><th className="right" style={{ paddingRight: 14 }}>Total</th></tr></thead>
                <tbody>
                  {invoice.lineItems.map((l, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: 14 }} className="small">{l.label}</td>
                      <td className="right num small">{l.qty}</td>
                      <td className="right num small">{fmtEUR(l.rate)}</td>
                      <td className="right num strong" style={{ paddingRight: 14 }}>{fmtEURprecise(l.qty * l.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', paddingTop: 6 }}>
            <div style={{ minWidth: 220 }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}><span className="muted small">Sous-total</span><span className="num">{fmtEURprecise(invoice.subtotal)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}><span className="muted small">TVA (0%)</span><span className="num muted">—</span></div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)' }}><span className="strong">Total</span><span className="num strong" style={{ fontSize: 18 }}>{fmtEURprecise(invoice.total)}</span></div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost"><I name="download" size={14} />PDF</button>
          {invoice.status === 'draft' && <button className="btn btn-secondary" onClick={() => updateStatus(invoice.id, 'sent')}><I name="send" size={14} />Marquer envoyée</button>}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && <button className="btn btn-primary" onClick={() => updateStatus(invoice.id, 'paid', new Date().toISOString().slice(0, 10))}><I name="check" size={14} />Marquer payée</button>}
          {invoice.status === 'paid' && <button className="btn btn-secondary" disabled><I name="check" size={14} />Payée le {fmtDate(invoice.paidDate)}</button>}
        </div>
      </div>
    </div>
  );
}

window.PageBilling = PageBilling;
