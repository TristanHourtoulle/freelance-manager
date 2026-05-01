// Main App — router + state
const { useState: useState_, useMemo: useMemo_ } = React;

function App() {
  const [store, setStore] = useState_(window.FM.Store);
  const [route, setRoute] = useState_({ page: 'login' });
  const [authed, setAuthed] = useState_(false);
  const { toasts, push: pushToast } = window.useToasts();

  const navigate = (r) => {
    // Auth gate: only login/register accessible when not authed
    if (!authed && r.page !== 'login' && r.page !== 'register') {
      // Treat navigation to an app page as "authentication success"
      setAuthed(true);
    }
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Wrap the auth-success path so login/register pages can flip the flag explicitly
  const navigateAuthed = (r) => { setAuthed(true); navigate(r); };

  const counts = useMemo_(() => ({
    clients: store.clients.filter(c => !c.archived).length,
    projects: store.projects.length,
    tasksOpen: store.tasks.filter(t => t.status === 'pending_invoice').length,
    invoicesOpen: store.invoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft').length,
  }), [store]);

  // Auth pages render full-bleed, no shell
  if (route.page === 'login') {
    return (<>
      <window.PageLogin navigate={navigateAuthed} toast={pushToast} switchTo={(p) => setRoute({ page: p })} />
      <window.Toasts toasts={toasts} />
    </>);
  }
  if (route.page === 'register') {
    return (<>
      <window.PageRegister navigate={navigateAuthed} toast={pushToast} switchTo={(p) => setRoute({ page: p })} />
      <window.Toasts toasts={toasts} />
    </>);
  }

  let crumbs = ['FreelanceManager'];
  let content = null;
  switch (route.page) {
    case 'dashboard':
      crumbs = ['FreelanceManager', 'Dashboard'];
      content = <window.PageDashboard navigate={navigate} store={store} />; break;
    case 'clients':
      crumbs = ['FreelanceManager', 'Clients'];
      content = <window.PageClients navigate={navigate} store={store} setStore={setStore} toast={pushToast} />; break;
    case 'client-detail': {
      const c = store.clients.find(cc => cc.id === route.clientId);
      crumbs = ['FreelanceManager', 'Clients', c ? `${c.firstName} ${c.lastName}` : '—'];
      content = <window.PageClientDetail navigate={navigate} store={store} setStore={setStore} route={route} />;
      break;
    }
    case 'projects':
      crumbs = ['FreelanceManager', 'Projets'];
      content = <window.PageProjects navigate={navigate} store={store} />; break;
    case 'tasks':
      crumbs = ['FreelanceManager', 'Tasks'];
      content = <window.PageTasks navigate={navigate} store={store} route={route} toast={pushToast} />; break;
    case 'billing':
      crumbs = ['FreelanceManager', 'Factures'];
      content = <window.PageBilling navigate={navigate} store={store} setStore={setStore} route={route} toast={pushToast} />; break;
    case 'invoice-new':
      crumbs = ['FreelanceManager', 'Factures', 'Nouvelle'];
      content = <window.PageInvoiceNew navigate={navigate} store={store} setStore={setStore} route={route} toast={pushToast} />; break;
    case 'analytics':
      crumbs = ['FreelanceManager', 'Analytics'];
      content = <window.PageAnalytics navigate={navigate} store={store} />; break;
    case 'settings':
      crumbs = ['FreelanceManager', 'Réglages'];
      content = (
        <div className="page">
          <div className="page-header"><div><h1 className="page-title">Réglages</h1><div className="page-sub">À venir dans une prochaine itération</div></div></div>
          <div className="card"><div className="empty"><div className="empty-title">Bientôt disponible</div><div>Cette page n'est pas encore implémentée.</div></div></div>
        </div>
      );
      break;
    default:
      content = <div className="page"><div className="empty">Page introuvable</div></div>;
  }

  return (
    <div className="app" data-screen-label={'00 ' + (route.page || 'dashboard')}>
      <window.Sidebar route={route} navigate={navigate} counts={counts} onLogout={() => { setAuthed(false); setRoute({ page: 'login' }); }} />
      <div className="main">
        <window.Topbar crumbs={crumbs} />
        {content}
      </div>
      <window.Toasts toasts={toasts} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
