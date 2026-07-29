import { useState } from 'react';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './pages/Dashboard';
import { Obyektlar } from './pages/Obyektlar';
import { Holat } from './pages/Holat';
import { ToastContainer } from './components/ui/Toast';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <>
      <Shell currentTab={currentTab} onTabChange={setCurrentTab}>
        {currentTab === 'dashboard' && <Dashboard />}
        {currentTab === 'obyektlar' && <Obyektlar />}
        {currentTab === 'holat' && <Holat />}
      </Shell>
      <ToastContainer />
    </>
  );
}
