const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestZayavka.tsx', 'utf8');

const thString = '<th className="text-left px-4 py-3 font-medium">Sana</th>';
if (!code.includes('Amallar</th>')) {
  code = code.replace(thString, thString + '\n              <th className="text-right px-4 py-3 font-medium">Amallar (Snabjeniya)</th>');
}

const tdString = '<td className="px-4 py-3 text-text-dim text-xs">\n                  {new Date(z.yaratildi).toLocaleDateString()}\n                </td>';
const amallar = `<td className="px-4 py-3 text-text-dim text-xs">
                  {new Date(z.yaratildi).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {z.holat === 'yangi' && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => alert('Birja va Tender moduliga yuboriladi...')} className="px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-md text-[11px] font-medium transition-colors" title="Birja/Tenderga chiqarish">
                        Tenderga (Birja)
                      </button>
                      <button onClick={() => alert('Skladdan obyektga perebroska qilinib, zayavka yopiladi...')} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md text-[11px] font-medium transition-colors" title="Ombordan yopish (Bajarildi)">
                        Skladdan berish
                      </button>
                    </div>
                  )}
                  {z.holat === 'jarayonda' && (
                    <span className="text-[11px] text-amber-500/70">Tenderda kutilmoqda...</span>
                  )}
                  {z.holat === 'bajarildi' && (
                    <span className="text-[11px] text-emerald-500/70">Yopilgan</span>
                  )}
                </td>`;

if (!code.includes('Skladdan berish')) {
  code = code.replace(tdString, amallar);
}

fs.writeFileSync('frontend/src/test02/TestZayavka.tsx', code);
console.log('TestZayavka updated with Actions');
