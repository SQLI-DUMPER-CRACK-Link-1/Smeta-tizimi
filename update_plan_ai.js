const fs = require('fs');
let text = fs.readFileSync('tizim02/GRAND_ARCHITECTURE_MANIFESTO.md', 'utf8');

const newSection = `
# 22.5 "QURUVCHI AI" WA SHNQ/SNiP NORMALARI KNOWLEDGE BASE
Tizimdagi AI nafaqat loyiha ma'lumotlarini, balki fundamental qurilish qoidalarini (Knowledge Base) ham bilishi va qo'llashi shart.
- **Normativ Baza (Vector DB):** O'zbekistonning barcha qurilish normalari (SHNQ, QMQ), xalqaro standartlar (SNiP, GOST, Eurocodes) PDF va matn shaklida RAG (Retrieval-Augmented Generation) tizimiga yuklanadi (Supabase pgvector).
- **Quruvchi AI (Konsultant):** Foydalanuvchilar (muhandislar, prorablar) AI bilan to'g'ridan-to'g'ri muloqot qilib, "Tom yopishda qanday qatlamlar bo'lishi shart?" yoki "Armatura choklari orasidagi masofa qancha bo'lishi kerak?" kabi savollarga aniq SHNQ bandiga havola (link) qilingan javoblarni olishadi.
- **Avtomat Nazorat:** Smetaga yozilgan yoki Faktda ishlatilgan materiallar (masalan, beton markasi) obyektning loyiha talabiga va SHNQ normalariga to'g'ri kelish-kelmasligi AI tomonidan fonga tekshirilib, Xavf (Risk) signali beriladi.
`;

text = text.replace(/# 23\. AI AGENTLAR/, newSection.trim() + '\n\n# 23. AI AGENTLAR');

fs.writeFileSync('tizim02/GRAND_ARCHITECTURE_MANIFESTO.md', text);

let text2 = fs.readFileSync('TIZIM_02_GLOBAL_CONSTRUCTION_OS_ARXITEKTURA_REJA.md', 'utf8');
text2 = text2.replace(/# 23\. AI AGENTLAR/, newSection.trim() + '\n\n# 23. AI AGENTLAR');
fs.writeFileSync('TIZIM_02_GLOBAL_CONSTRUCTION_OS_ARXITEKTURA_REJA.md', text2);
