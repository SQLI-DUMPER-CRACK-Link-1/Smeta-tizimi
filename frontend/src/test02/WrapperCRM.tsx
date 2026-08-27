import React, { useState } from 'react';
import { Mail, Building, Users } from 'lucide-react';
import TestKorrespondensiya from './TestKorrespondensiya';
import TestSotuvCrm from './TestSotuvCrm';

export default function WrapperCRM() {
  const [activeTab, setActiveTab] = useState<'edo' | 'sotuv'>('edo');

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Wrapper Tabs */}
      <div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">
        <button
          onClick={() => setActiveTab('edo')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'edo' ? 'border-sky-500 text-sky-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Mail size={16} /> Korrespondensiya (B2B)
        </button>
        <button
          onClick={() => setActiveTab('sotuv')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sotuv' ? 'border-sky-500 text-sky-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Building size={16} /> Uy Sotuv (Developer CRM)
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'edo' && <TestKorrespondensiya />}
        {activeTab === 'sotuv' && <TestSotuvCrm />}
      </div>
    </div>
  );
}
