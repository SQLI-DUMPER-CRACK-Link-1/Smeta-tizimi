const fs = require('fs');

let code = fs.readFileSync('frontend/src/test02/TestKontragent.tsx', 'utf8');

// Replace the INN input with input + button
const searchButton = `
                  <label className="block font-medium text-text-dim mb-1 flex justify-between">
                    <span>STIR (INN)</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">Didox API (Mock)</span>
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      maxLength={9}
                      value={formData.inn}
                      onChange={(e) => setFormData(p => ({...p, inn: e.target.value.replace(/[^0-9]/g, '')}))}
                      placeholder="9 xonali raqam"
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 font-mono text-white focus:border-accent outline-none"
                    />
                    <button 
                      onClick={handleFetchINN}
                      disabled={yuklanmoqda}
                      className="bg-surface-2 hover:bg-border text-white px-3 rounded-lg border border-border transition-colors flex items-center justify-center"
                    >
                      {yuklanmoqda ? <RefreshCw size={18} className="animate-spin"/> : <Search size={18} />}
                    </button>
                  </div>
`;

code = code.replace(/<label className="block font-medium text-text-dim mb-1">STIR \(INN\)<\/label>\s*<input[^>]+>/s, searchButton);

const fetchFn = `
  const handleFetchINN = async () => {
    if (formData.inn.length !== 9) return toast('INN 9 xonali bo\\'lishi shart', 'warn');
    setYuklanmoqda(true);
    // YAKUNIY ARXITEKTURA MANIFESTI: 21. DIDОX / EDO
    setTimeout(() => {
      setYuklanmoqda(false);
      if (formData.inn === '207111222') {
        setFormData(p => ({ ...p, nom: 'GLOBAL CONSTRUCTION MCHJ', rahbar: 'Toshmatov Eshmat', manzil: 'Toshkent sh, Yunusobod', mfo: '00444', hisobRaqam: '20208000900111222333', qqsTolovchi: true }));
        toast('Didox orqali ma\\'lumotlar tortildi!', 'success');
      } else {
        setFormData(p => ({ ...p, nom: 'MOCK COMPANY ' + formData.inn, rahbar: 'Noma\\'lum', manzil: 'Toshkent', mfo: '00014', hisobRaqam: '20208000000000000000', qqsTolovchi: false }));
        toast('Soliq.uz orqali ma\\'lumot topildi', 'success');
      }
    }, 800);
  };
`;

code = code.replace(/const handleFetchINN = async \(\) => \{[\s\S]*?\};/, fetchFn);

fs.writeFileSync('frontend/src/test02/TestKontragent.tsx', code);
