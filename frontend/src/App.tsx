import { useState } from 'react';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';
import { Obyektlar } from './pages/Obyektlar';

function Holat() {
  return <div className="text-xl">Smeta Holati Page</div>;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <Shell currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === 'dashboard' && <Dashboard />}
      {currentTab === 'obyektlar' && <Obyektlar />}
      {currentTab === 'holat' && <Holat />}
    </Shell>
  );
}
