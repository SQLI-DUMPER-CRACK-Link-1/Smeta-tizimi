import { ReactNode } from 'react';
import { LayoutDashboard, FolderTree, FileSpreadsheet } from 'lucide-react';

export function Sidebar({ currentTab, onTabChange }: { currentTab: string, onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'obyektlar', icon: <FolderTree size={20} />, label: 'Obyektlar' },
    { id: 'holat', icon: <FileSpreadsheet size={20} />, label: 'Smeta Holati' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-surface border-r border-border h-full flex flex-col transition-all duration-200">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm">G</span>
          SMETA GAS
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {tabs.map(tab => {
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-120 ${
                active 
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]' 
                  : 'text-text-dim hover:bg-surface-2 hover:text-text'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </nav>
    </aside>
  );
}

export function Topbar({ activeObject, onObjectChange }: { activeObject: string, onObjectChange: (o: string) => void }) {
  return (
    <header className="h-16 flex items-center px-6 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-lg font-semibold">Tizim Boshqaruvi</h1>
        {/* We can place global search or object selector here */}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]"></div>
          <span className="text-xs text-text-dim font-medium uppercase tracking-wider">Online</span>
        </div>
      </div>
    </header>
  );
}

export function Shell({ children, currentTab, onTabChange }: { children: ReactNode, currentTab: string, onTabChange: (t: string) => void }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text selection:bg-accent/30">
      <Sidebar currentTab={currentTab} onTabChange={onTabChange} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar activeObject="" onObjectChange={() => {}} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
