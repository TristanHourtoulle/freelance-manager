// Sidebar + Topbar shell
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function Sidebar({ route, navigate, counts }) {
  const items = [
    { section: 'Pilotage' },
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { section: 'Travail' },
    { id: 'clients', label: 'Clients', icon: 'users', badge: counts.clients },
    { id: 'projects', label: 'Projets', icon: 'folder', badge: counts.projects },
    { id: 'tasks', label: 'Tasks', icon: 'check-square', badge: counts.tasksOpen },
    { section: 'Finance' },
    { id: 'billing', label: 'Factures', icon: 'invoice', badge: counts.invoicesOpen },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { section: 'Système' },
    { id: 'settings', label: 'Réglages', icon: 'settings' },
  ];
  const me = window.FM.Store.me;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <div className="brand-name">FreelanceManager</div>
          <div className="brand-sub">v0.4 · perso</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, overflowY: 'auto' }}>
        {items.map((it, i) =>
          it.section
            ? <div key={'s' + i} className="nav-section">{it.section}</div>
            : (
              <div key={it.id}
                className={'nav-item' + (route.page === it.id ? ' active' : '')}
                onClick={() => navigate({ page: it.id })}>
                <I name={it.icon} size={16} />
                <span>{it.label}</span>
                {it.badge != null && <span className="badge">{it.badge}</span>}
              </div>
            )
        )}
      </div>
      <div className="sidebar-footer">
        <div className="avatar">{window.FM.initials(me.name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="me-name truncate">{me.name}</div>
          <div className="me-email truncate">{me.email}</div>
        </div>
        <div className="icon-btn" title="Déconnexion"><I name="logout" size={15} /></div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep"><I name="chevron-right" size={12} /></span>}
            <span className={i === crumbs.length - 1 ? 'cur' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-search">
        <I name="search" size={14} className="muted" />
        <input placeholder="Rechercher tasks, clients, factures…" />
        <span className="kbd">⌘K</span>
      </div>
      <div className="icon-btn" title="Notifications" style={{ position: 'relative' }}>
        <I name="bell" size={16} />
        <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: 'var(--danger)', borderRadius: '99px' }}></span>
      </div>
    </div>
  );
}

// Toast system (simple)
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, push };
}

function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={'toast ' + t.kind}>
          <I name="check" size={16} style={{ color: 'var(--accent)' }} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending_invoice: { label: 'Pending Invoice', cls: 'pill-pending' },
    done: { label: 'Done', cls: 'pill-done' },
    in_progress: { label: 'In Progress', cls: 'pill-draft' },
    backlog: { label: 'Backlog', cls: 'pill-draft' },
    draft: { label: 'Brouillon', cls: 'pill-draft' },
    sent: { label: 'Envoyée', cls: 'pill-sent' },
    paid: { label: 'Payée', cls: 'pill-paid' },
    overdue: { label: 'En retard', cls: 'pill-overdue' },
  };
  const m = map[status] || { label: status, cls: 'pill-draft' };
  return <span className={'pill ' + m.cls}>{m.label}</span>;
}

function BillingTypePill({ type }) {
  const map = {
    daily: { label: 'TJM', cls: 'pill-daily' },
    fixed: { label: 'Forfait', cls: 'pill-fixed' },
    hourly: { label: 'Horaire', cls: 'pill-hourly' },
  };
  const m = map[type] || { label: type, cls: 'pill-draft' };
  return <span className={'pill pill-no-dot ' + m.cls}>{m.label}</span>;
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose}><I name="x" size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.useToasts = useToasts;
window.Toasts = Toasts;
window.StatusPill = StatusPill;
window.BillingTypePill = BillingTypePill;
window.Modal = Modal;
