import React, { useState } from 'react';
import { FolderKanban, Building2, Network, CheckCircle2 } from 'lucide-react';
import TestLoyiha from './TestLoyiha';
import TestObyektlar from './TestObyektlar';
import TestXarita from './TestXarita';
import TestFakt from './TestFakt';
import TestAosr from './TestAosr';

export default function WrapperPortfel() {
  const [activeTab, setActiveTab] = useState<'loyiha' | 'obyekt' | 'fakt' | 'xarita' | 'aosr'>('loyiha');

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Wrapper Tabs */}
      <div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">
        <button
          onClick={() => setActiveTab('loyiha')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'loyiha' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <FolderKanban size={16} /> Loyihalar
        </button>
        <button
          onClick={() => setActiveTab('obyekt')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'obyekt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Building2 size={16} /> Obyektlar
        </button>
        <button
          onClick={() => setActiveTab('fakt')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'fakt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <CheckCircle2 size={16} /> Fakt (Bajarilgan)
        </button>
        <button
          onClick={() => setActiveTab('xarita')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'xarita' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Network size={16} /> Xarita (Mind Map)
        </button>
        <button
          onClick={() => setActiveTab('aosr')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'aosr' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <FolderKanban size={16} /> AOSR
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'loyiha' && <TestLoyiha />}
        {activeTab === 'obyekt' && <TestObyektlar />}
        {activeTab === 'fakt' && <TestFakt />}
        {activeTab === 'xarita' && <TestXarita />}
        {activeTab === 'aosr' && <TestAosr />}
      </div>
    </div>
  );
}
