const fs = require('fs');

// 1. Fix App.tsx
let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
if(!app.includes('TestDaraxt')) {
    app = app.replace("const TestSpravochnik = lazy(() => import('./test02/TestSpravochnik'));", "const TestSpravochnik = lazy(() => import('./test02/TestSpravochnik'));\nconst TestDaraxt    = lazy(() => import('./test02/TestDaraxt'));");
    app = app.replace('<Route path="smeta" element={<TestSmetaBirlashgan />} />', '<Route path="smeta" element={<TestSmetaBirlashgan />} />\n            <Route path="daraxt" element={<TestDaraxt />} />');
    fs.writeFileSync('frontend/src/App.tsx', app);
}

// 2. Fix WrapperMoliya.tsx to include Smeta / F2 tab
let moliya = fs.readFileSync('frontend/src/test02/WrapperMoliya.tsx', 'utf8');
if(!moliya.includes('TestSmetaBirlashgan')) {
    moliya = moliya.replace("import TestFaktura from './TestFaktura';", "import TestFaktura from './TestFaktura';\nimport TestSmetaBirlashgan from './TestSmetaBirlashgan';");
    moliya = moliya.replace("useState<'shartnoma' | 'tolov' | 'faktura'>('shartnoma');", "useState<'smeta' | 'shartnoma' | 'tolov' | 'faktura'>('smeta');");
    
    const newTab = `
        <button
          onClick={() => setActiveTab('smeta')}
          className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 \${activeTab === 'smeta' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'}\`}
        >
          <FileText size={16} /> Smeta & F2
        </button>`;
        
    moliya = moliya.replace('<div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">', '<div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">' + newTab);
    
    moliya = moliya.replace("{activeTab === 'shartnoma' && <TestShartnoma />}", "{activeTab === 'smeta' && <TestSmetaBirlashgan />}\n        {activeTab === 'shartnoma' && <TestShartnoma />}");
    fs.writeFileSync('frontend/src/test02/WrapperMoliya.tsx', moliya);
}
