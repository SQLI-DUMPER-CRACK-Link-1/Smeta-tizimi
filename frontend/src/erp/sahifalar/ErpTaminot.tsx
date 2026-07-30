import React from 'react';

export default function ErpTaminot() {
  return (
    <div className="p-8 text-white h-full overflow-auto">
      <h1 className="text-3xl font-bold mb-4">Ta'minot va Zayavkalar (Snabjeniye)</h1>
      <p className="text-slate-400 mb-8">Obyektlardan tushayotgan zayavkalar, ularning holati va xarid qilinish jarayoni.</p>
      
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center h-64">
        <div className="text-4xl mb-4">🛒</div>
        <h3 className="text-xl font-bold">Ta'minot moduli tez orada...</h3>
        <p className="text-slate-500 mt-2 text-center max-w-md">TMC (Tovar moddiy boyliklar) buyurtmalari ro'yxati va ta'minotchilar bilan ishlash tizimi.</p>
      </div>
    </div>
  );
}
