const fs = require('fs');
let crm = fs.readFileSync('frontend/src/test02/WrapperCRM.tsx', 'utf8');

if (!crm.includes('TestInvite')) {
    crm = crm.replace("import TestSotuvCrm from './TestSotuvCrm';", "import TestSotuvCrm from './TestSotuvCrm';\nimport TestInvite from './TestInvite';");
    crm = crm.replace("useState<'edo' | 'sotuv'>('edo');", "useState<'edo' | 'sotuv' | 'invite'>('invite');");
    
    const newTab = `
        <button
          onClick={() => setActiveTab('invite')}
          className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 \${activeTab === 'invite' ? 'border-sky-500 text-sky-400' : 'border-transparent text-zinc-400 hover:text-white'}\`}
        >
          <Users size={16} /> Taklif va Bog'lanish
        </button>`;
        
    crm = crm.replace('<div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">', '<div className="flex items-center gap-2 px-6 pt-4 border-b border-white/10 bg-black/20">' + newTab);
    
    crm = crm.replace("{activeTab === 'edo' && <TestKorrespondensiya />}", "{activeTab === 'invite' && <TestInvite />}\n        {activeTab === 'edo' && <TestKorrespondensiya />}");
    
    fs.writeFileSync('frontend/src/test02/WrapperCRM.tsx', crm);
}
