import React, { useMemo, useState, useRef } from 'react';
import { useFakturalarOl, useFakturaYoz, useFakturaFaylYoz, type FakturaItem } from '../../api/hooks';
import { Sahifa, Holatlar, Jadval, Qidiruv, Tugma } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { FileUp, Save, X } from 'lucide-react';
import { FmtN } from '../../lib/format';

export function Fakturalar() {
  const soragan = useFakturalarOl();
  const yoz = useFakturaYoz();
  const faylYoz = useFakturaFaylYoz();
  const ocr = useFakturaOCR();
  
  const [q, setQ] = useState('');
  const [modalOchiq, setModalOchiq] = useState(false);
  
  const [yangiKiritmalar, setYangiKiritmalar] = useState<FakturaItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hammasi = soragan.data?.fakturalar ?? [];

  const satrlar = useMemo(() => {
    const s = q.trim().toUpperCase();
    return hammasi.filter((m) => {
      if (!s) return true;
      return m.nomi.toUpperCase().includes(s) || 
             m.fakturaRaqami.toUpperCase().includes(s) ||
             m.postavshik.toUpperCase().includes(s);
    });
  }, [hammasi, q]);

  const loadPdfJs = async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = () => reject(new Error('pdf.js yuklanmadi'));
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsParsing(true);
    setYangiKiritmalar([]);
    let barchaTovarlar: FakturaItem[] = [];
    
    try {
      const pdfjsLib: any = await loadPdfJs();
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setParsingStatus(`O'qilmoqda: ${i + 1} / ${files.length} (${file.name})`);
        
        // 3. Faylni Base64 formatga o'tkazish
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // 1. PDF yoki rasm matnini o'qish
        let fullText = '';
        if (file.type.startsWith('image/')) {
          setParsingStatus(`Rasm o'qilmoqda (Google OCR): ${i + 1} / ${files.length} (${file.name})`);
          const ocrRes = await ocr.mutateAsync({ base64, mimeType: file.type, nomi: file.name });
          if (ocrRes?.ok && ocrRes.text) {
            fullText = ocrRes.text.replace(/\s+/g, ' ');
          } else {
            toast(`OCR xatosi (${file.name}): ${ocrRes?.xabar}`, 'danger');
          }
        } else {
          setParsingStatus(`PDF o'qilmoqda: ${i + 1} / ${files.length} (${file.name})`);
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let j = 1; j <= pdf.numPages; j++) {
            const page = await pdf.getPage(j);
            const textContent = await page.getTextContent();
            textContent.items.forEach((item: any) => { fullText += item.str + ' '; });
          }
          fullText = fullText.replace(/\s+/g, ' ');

          // Agar PDF bo'lsa lekin ichida matn yo'q bo'lsa (skaner PDF), OCR qilamiz
          if (fullText.trim().length < 50) {
            setParsingStatus(`Skaner PDF aniqlandi, OCR qilinmoqda: ${i + 1} / ${files.length}`);
            const ocrRes = await ocr.mutateAsync({ base64, mimeType: 'application/pdf', nomi: file.name });
            if (ocrRes?.ok && ocrRes.text) {
              fullText = ocrRes.text.replace(/\s+/g, ' ');
            }
          }
        }
        
        // 2. Matndan tovarlarni ajratish
        const { items, supplier } = parseFakturaText(fullText);
        barchaTovarlar = [...barchaTovarlar, ...items];
        
        // 4. Orqa fonga PDF ni saqlash uchun yuborish
        try {
          const fRes = await faylYoz.mutateAsync({ base64, nomi: file.name, postavshik: supplier });
          if (fRes && fRes.ok === false) {
             toast(`${file.name} xato: ${fRes.xabar}`, 'danger');
          } else if (fRes?.ok) {
             toast(`${file.name} Drive ga yuklandi`, 'ok');
          }
        } catch(err: any) {
            console.error("Faylni saqlashda xato:", err);
            toast(`${file.name} ni Drive ga saqlab bo'lmadi: ${err.message}`, 'danger');
        }
      }
      
      if (barchaTovarlar.length > 0) {
        setYangiKiritmalar(barchaTovarlar);
        toast(`Jami ${barchaTovarlar.length} ta tovar topildi`);
      } else {
        toast("Fakturalar ichidan tovarlarni ajratib bo'lmadi.");
      }
      
    } catch (err: any) {
      console.error(err);
      toast("Fakturani o'qishda xato: " + err.message);
    } finally {
      setIsParsing(false);
      setParsingStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const parseFakturaText = (text: string): { items: FakturaItem[], supplier: string } => {
    let docNo = '';
    let docDate = '';
    let contractNo = '';
    let contractDate = '';
    let supplier = '';
    
    // Shartnoma sanasi va raqami
    const shartMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*([^\s]+)-сонли\s*шартномага/i);
    if (shartMatch) {
      contractDate = shartMatch[1];
      contractNo = shartMatch[2];
    }
    
    // Faktura sanasi va raqami
    const fakMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*([^\s]+)-сонли(?:\s*Ҳисобварақ-фактура)?/i);
    if (fakMatch) {
      docDate = fakMatch[1];
      docNo = fakMatch[2];
    }
    
    const supplierMatch = text.match(/(?:Етказиб\s*берувчи|Воситачи|Ижрочи|Буюртмачи):(.*?)(?:Манзил:|Етказиб\s*берувчининг|Воситачининг|Ижрочининг|Буюртмачининг)/i);
    if (supplierMatch) {
      supplier = supplierMatch[1].trim();
    }
    

    const tovarlar: FakturaItem[] = [];
    
    const n = '(-?\\d+(?:\\s\\d{3})*(?:\\.\\d+)?)';
    const amtRegex = new RegExp(
        n + '\\s+' + // Miqdor
        n + '\\s+' + // Narx
        n + '\\s+' + // Jami NDS siz
        '(?:(?:Без\\s*акциз(?:а|сиз)|Акцизсиз|\\d+\\s*%)\\s+' + n + '\\s+)?' + // Optional Aksiz
        '(\\d+\\s*%|Без\\s*НДС|ҚҚСсиз|Без\\s*НДС\\s*\\(0\\)|ҚҚСсиз\\s*\\(0\\))\\s+' + // NDS stavka
        n + '\\s+' + // NDS Summa
        n + // Jami
        '(?:\\s+(?:Олди-сотди|Ўз\\.иш\\.чиқ\\.|Импорт|Четдан келтирилган|Ўз эҳтиёжлари учун ишлаб чиқарилган))?',
        'gi'
    );
    
    let match;
    let lastEnd = 0;
    
    while ((match = amtRegex.exec(text)) !== null) {
        let precedingText = text.substring(lastEnd, match.index).trim();
        lastEnd = amtRegex.lastIndex;
        
        let tokens = precedingText.split(/\s+/);
        let birligi = tokens.pop() || ''; // Odatda eng oxirgisi o'lchov birligi (dona, tonna)
        let nameStr = tokens.join(' ');
        
        if (tovarlar.length === 0) {
            // Birinchi qator uchun header'ni (ustun raqamlarini) qirqib tashlash kerak
            const headerMatch = nameStr.match(/(?:\s9|\s10|\s11|\s12|\s13|\s14)\s+(1\s+.*)$/);
            if (headerMatch) {
                nameStr = headerMatch[1];
            } else {
                const chiIdx = nameStr.toLowerCase().lastIndexOf('чиқиши');
                if (chiIdx !== -1) {
                    let afterChi = nameStr.substring(chiIdx + 6).trim();
                    const colMatch = afterChi.match(/\d+(?:\s+\d+)*\s+(1\s+.*)$/);
                    if (colMatch) nameStr = colMatch[1];
                    else nameStr = afterChi;
                }
            }
        }
        
        // Boshidagi qator raqamini olib tashlash (1, 2, 3...)
        nameStr = nameStr.replace(/^\d+\s+/, '').trim();
        
        // Komitent (vositachi) nomini qirqib tashlash
        const guvoxMatch = nameStr.match(/\(гуво[хҳ]нома[^)]+\)\s*/i);
        if (guvoxMatch) {
            nameStr = nameStr.substring(guvoxMatch.index! + guvoxMatch[0].length).trim();
        }
        
        // 15+ xonali MXIK kodini olib tashlash
        const kodMatch = nameStr.match(/\d{15,}/);
        if (kodMatch) {
            nameStr = nameStr.replace(kodMatch[0], '').replace(/-\s*-/g, '-').trim();
            if (nameStr.startsWith('-')) nameStr = nameStr.substring(1).trim();
        }
        
        const parseNum = (s: string) => {
            if (!s) return 0;
            return parseFloat(s.replace(/\s+/g, '').replace(/,/g, '.'));
        };
        
        tovarlar.push({
            fakturaRaqami: docNo, 
            postavshik: supplier, 
            kelganSana: docDate, 
            shartnomaRaqami: contractNo, 
            shartnomaSanasi: contractDate,
            nomi: nameStr,
            birligi: birligi,
            miqdori: parseNum(match[1]),
            narxi: parseNum(match[2]),
            jamiNdsSiz: parseNum(match[3]),
            ndsSummasi: parseNum(match[6]),
            jamiNdsBilan: parseNum(match[7])
        });
    }
    
    return { items: tovarlar, supplier: supplier || "Noma'lum" };
  };

  const handleSave = async () => {
    // FAQAT dublikat bo'lmaganlarini saqlash
    const yaroqli = yangiKiritmalar.filter(item => {
      const isDup = item.fakturaRaqami && item.postavshik && hammasi.some(x => x.fakturaRaqami === item.fakturaRaqami && x.postavshik === item.postavshik);
      return !isDup;
    });

    if (yaroqli.length === 0) {
      toast("Saqlash uchun yangi tovar yo'q (hammasi dublikat)", "warn");
      return;
    }
    
    const res = await yoz.mutateAsync(yaroqli);
    if (res?.ok) {
      toast(`${res.soni} ta qator muvaffaqiyatli saqlandi!`, 'ok');
      setModalOchiq(false);
      setYangiKiritmalar([]);
      soragan.refetch();
    } else {
      toast("Xatolik: " + res?.xabar, 'danger');
    }
  };

  const ustunlar = [
    { kalit: 'kelganSana', nom: 'Sana', en: '100px', chiz: (m: any) => <span className="text-text-dim text-[13px]">{m.kelganSana}</span> },
    { kalit: 'fakturaRaqami', nom: 'Faktura №', en: '120px', chiz: (m: any) => <span className="text-accent text-[13px] font-medium">{m.fakturaRaqami}</span> },
    { kalit: 'postavshik', nom: 'Postavshik', chiz: (m: any) => <span className="text-text truncate text-[13px]">{m.postavshik}</span> },
    { kalit: 'nomi', nom: 'Maxsulot nomi', chiz: (m: any) => <span className="text-text font-medium text-[13px]">{m.nomi}</span> },
    { kalit: 'birligi', nom: 'Birlik', en: '70px', chiz: (m: any) => <span className="text-text-dim text-[13px]">{m.birligi}</span> },
    { kalit: 'miqdori', nom: 'Miqdor', raqam: true, en: '100px', chiz: (m: any) => <FmtN val={m.miqdori} /> },
    { kalit: 'narxi', nom: 'Narx (NDS siz)', raqam: true, en: '120px', chiz: (m: any) => <FmtN val={m.narxi} /> },
    { kalit: 'jamiNdsBilan', nom: 'Jami (NDS bilan)', raqam: true, en: '130px', chiz: (m: any) => <span className="text-ok font-medium"><FmtN val={m.jamiNdsBilan} /></span> },
  ];

  return (
    <Sahifa
      sarlavha="Fakturalar"
      tavsif="PDF fakturalarni o'qib, barcha materiallarni yig'uvchi jurnal"
      yangilangan={soragan.dataUpdatedAt}
      onYangila={() => soragan.refetch()}
      yangilanmoqda={soragan.isFetching}
      amallar={
        <div className="flex gap-3">
          <Qidiruv qiymat={q} ozgardi={setQ} placeholder="Faktura, nomi..." />
          <Tugma tur="primary" ikonka={<FileUp size={16} />} onBos={() => setModalOchiq(true)}>
            Faktura yuklash (PDF)
          </Tugma>
        </div>
      }
    >
      <Holatlar soragan={soragan} bosh={{ matn: 'Fakturalar jurnali bo\'sh', izoh: 'Hali hech qanday faktura kiritilmagan.' }}>
        {() => (
          <div className="karta overflow-hidden shadow-lg border border-border">
            <Jadval ustunlar={ustunlar} satrlar={satrlar} kalit={(m, i) => m.id || i.toString()} />
          </div>
        )}
      </Holatlar>

      {modalOchiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="karta flex max-h-full w-full max-w-5xl flex-col shadow-2xl border border-white/10 relative overflow-hidden bg-[var(--surface-1)]">
            <div className="flex items-center justify-between border-b border-border bg-black/20 p-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileUp className="text-accent" size={20} />
                Fakturani o'qish
              </h2>
              <button onClick={() => setModalOchiq(false)} className="text-text-dim hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-4 overflow-y-auto">
              {!yangiKiritmalar.length ? (
                <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4 bg-black/10 hover:bg-black/20 transition-colors">
                  <input 
                    type="file" 
                    accept=".pdf, image/png, image/jpeg, image/jpg"
                    multiple
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                  />
                  <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                    <FileUp size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white mb-1">Faktura (PDF yoki Rasm) tanlang</h3>
                    <p className="text-sm text-text-dim">Bir nechta PDF, JPG, PNG fayllarni birdaniga tanlashingiz mumkin</p>
                  </div>
                  <Tugma tur="primary" band={isParsing} onBos={() => fileInputRef.current?.click()}>
                    {isParsing ? 'O\'qilmoqda...' : 'Fayllarni tanlash'}
                  </Tugma>
                  {parsingStatus && <div className="text-accent text-sm mt-2">{parsingStatus}</div>}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center mt-2">
                    <h3 className="font-bold text-white">O'qilgan tovarlar ro'yxati:</h3>
                    <span className="text-sm text-text-dim px-3 py-1 bg-[var(--surface-2)] rounded-full">
                      Jami {yangiKiritmalar.length} ta tovar
                    </span>
                  </div>
                  
                  <div className="border border-border rounded-xl overflow-hidden bg-black/20 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[var(--surface-2)] border-b border-border text-text-dim">
                        <tr>
                          <th className="px-3 py-2 font-medium">Postavshik</th>
                          <th className="px-3 py-2 font-medium">Faktura "-</th>
                          <th className="px-3 py-2 font-medium">Nomi</th>
                          <th className="px-3 py-2 font-medium">Birlik</th>
                          <th className="px-3 py-2 font-medium text-right">Miqdor</th>
                          <th className="px-3 py-2 font-medium text-right">Narxi (so'm)</th>
                          <th className="px-3 py-2 font-medium text-right">Jami Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {yangiKiritmalar.map((t, i) => {
                          const isDup = t.fakturaRaqami && t.postavshik && hammasi.some(x => x.fakturaRaqami === t.fakturaRaqami && x.postavshik === t.postavshik);
                          return (
                          <tr key={i} className={`hover:bg-white/5 ${isDup ? 'opacity-50 bg-danger/10' : ''}`} title={isDup ? "Bu faktura oldin kiritilgan (Dublikat)" : ""}>
                            <td className="px-3 py-2 max-w-[150px]">
                              <input className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none text-white text-sm" placeholder="Postavshik" value={t.postavshik} onChange={(e) => {
                                const nw = [...yangiKiritmalar]; nw[i].postavshik = e.target.value; setYangiKiritmalar(nw);
                              }}/>
                            </td>
                            <td className="px-3 py-2 w-32">
                              <input className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none text-text-dim text-sm" placeholder="Faktura №" value={t.fakturaRaqami} onChange={(e) => {
                                const nw = [...yangiKiritmalar]; nw[i].fakturaRaqami = e.target.value; setYangiKiritmalar(nw);
                              }}/>
                            </td>
                            <td className="px-3 py-2 max-w-[250px] truncate text-white" title={t.nomi}>
                              <input className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none" value={t.nomi} onChange={(e) => {
                                const nw = [...yangiKiritmalar]; nw[i].nomi = e.target.value; setYangiKiritmalar(nw);
                              }}/>
                            </td>
                            <td className="px-3 py-2 text-text-dim w-24">
                              <input className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none" value={t.birligi} onChange={(e) => {
                                const nw = [...yangiKiritmalar]; nw[i].birligi = e.target.value; setYangiKiritmalar(nw);
                              }}/>
                            </td>
                            <td className="px-3 py-2 text-right w-24">
                              <input className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none text-right font-medium" type="number" value={t.miqdori} onChange={(e) => {
                                const nw = [...yangiKiritmalar]; nw[i].miqdori = Number(e.target.value); setYangiKiritmalar(nw);
                              }}/>
                            </td>
                            <td className="px-3 py-2 text-right w-32"><FmtN val={t.narxi} /></td>
                            <td className="px-3 py-2 text-right font-bold text-ok w-32"><FmtN val={t.jamiNdsBilan} /></td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="border-t border-border bg-black/20 p-4 flex justify-end gap-3 items-center">
              {yangiKiritmalar.some(t => t.fakturaRaqami && t.postavshik && hammasi.some(x => x.fakturaRaqami === t.fakturaRaqami && x.postavshik === t.postavshik)) && (
                <span className="text-danger text-sm mr-auto font-medium">* Dublikat qatorlar saqlanmaydi!</span>
              )}
              <Tugma onBos={() => setModalOchiq(false)}>Bekor qilish</Tugma>
              {yangiKiritmalar.length > 0 && (
                <Tugma tur="primary" onBos={handleSave} band={yoz.isPending} ikonka={<Save size={16} />}>
                  {yoz.isPending ? "Saqlanmoqda..." : "Tasdiqlash va Saqlash"}
                </Tugma>
              )}
            </div>
          </div>
        </div>
      )}
    </Sahifa>
  );
}

export default Fakturalar;
