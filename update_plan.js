const fs = require('fs');
let text = fs.readFileSync('tizim02/GRAND_ARCHITECTURE_MANIFESTO.md', 'utf8');

const newSection = `
# 16.5 QA/QC, LABORATORIYA VA AVTOMATIK HUJJATLAR (AOSR, APPOK)
Qurilish sifatini nazorat qilish va topshirish hujjatlari (Executive Documentation) to'liq raqamlashtiriladi:
- **Avto-hujjat generatsiyasi:** AOSR (Yashirin ishlar akti) va APPOK (Mas'ul konstruksiyalar akti) quruq reestr emas, balki Word/PDF hujjat sifatida Tizim tomonidan to'g'ridan-to'g'ri shakllantiriladi. Tizim fakt ma'lumotlariga qarab rasmiy shablonni to'ldiradi.
- **Laboratoriya Nazorati:** Beton, tuproq va boshqa qurilish materiallari bo'yicha laboratoriya xulosalari obyektning konstruksiyalariga aniq ID bilan bog'lanadi. 
- **Sertifikatlar Bazasi:** Materiallarning muvofiqlik sertifikatlari va pasportlari yagona reyestrda saqlanadi. AOSR qilinayotganda ushbu sertifikatlar majburiy tarzda aktga ilova qilinadi.
- Sifat moduli (Texnadzor xulosalari) orqali yopilmagan nuqsoni bor ishlarga F2 (to'lov) qilinishi bloklanadi.
`;

text = text.replace(/# 17\. DID[A-Z]* \/ EDO/, newSection.trim() + '\n\n# 17. DID?X / EDO');

const newPhase = `- Phase 8.5 ?" QA/QC & Auto-Docs (Lab, Certs, APPOK)`;
text = text.replace(/- Phase 8 [^\n]+/, match => match + '\n' + newPhase);

fs.writeFileSync('tizim02/GRAND_ARCHITECTURE_MANIFESTO.md', text);

let text2 = fs.readFileSync('TIZIM_02_GLOBAL_CONSTRUCTION_OS_ARXITEKTURA_REJA.md', 'utf8');
text2 = text2.replace(/# 17\. DID[A-Z]* \/ EDO/, newSection.trim() + '\n\n# 17. DID?X / EDO');
text2 = text2.replace(/- Phase 8 [^\n]+/, match => match + '\n' + newPhase);
fs.writeFileSync('TIZIM_02_GLOBAL_CONSTRUCTION_OS_ARXITEKTURA_REJA.md', text2);
