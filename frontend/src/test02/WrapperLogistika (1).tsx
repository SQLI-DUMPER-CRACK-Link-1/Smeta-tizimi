import React, { useState } from 'react';
import { Box, Building2, ShoppingCart, Layers } from 'lucide-react';
import TestSklad from './TestSklad';
import TestKontragent from './TestKontragent';
import TestBirja from './TestBirja';
import TestMaterialAlias from './TestMaterialAlias';

export default function WrapperLogistika() {
  const [activeTab, setActiveTab] = useState<'sklad' | 'kontragent' | 'birja' | 'alias'>('sklad');

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Wrapper Tabs */}
      <div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">
        <button
          onClick={() => setActiveTab('sklad')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sklad' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Box size={16} /> Sklad (WMS)
        </button>
        <button
          onClick={() => setActiveTab('kontragent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'kontragent' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Building2 size={16} /> Kontragentlar
        </button>
        <button
          onClick={() => setActiveTab('birja')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'birja' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <ShoppingCart size={16} /> Ta'minot & Birja
        </button>
        <button
          onClick={() => setActiveTab('alias')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'alias' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
        >
          <Layers size={16} /> Material AI Sozlama
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'sklad' && <TestSklad />}
        {activeTab === 'kontragent' && <TestKontragent />}
        {activeTab === 'birja' && <TestBirja />}
        {activeTab === 'alias' && <TestMaterialAlias />}
      </div>
    </div>
  );
}
