import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbFakturalarOl, sbFakturaYoz } from '../api/t2-faktura';
import { sbDidoxHarakat } from '../api/t2-didox';

export default function TestFaktura() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [fakturalar, setFakturalar] = useState<any[]>([]);

  useEffect(() => {
    sbFakturalarOl(aktKomp).then(r => {
      if (r.ok && r.qatorlar) setFakturalar(r.qatorlar);
    });
  }, [aktKomp]);

  const sinx = async () => {
    const res = await sbDidoxHarakat('sinxron_boshla');
    alert(res.status);
  };
  
  const ocr = async () => {
    const res = await sbDidoxHarakat('ocr_parse');
    alert(res.status);
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Elektron Hisob Fakturalar (Didox + OCR)</h1>
      <div className="flex gap-2 mb-4">
        <button className="bg-emerald-600 px-4 py-2 hover:bg-emerald-500 rounded" onClick={sinx}>Didox Sinx</button>
        <button className="bg-purple-600 px-4 py-2 hover:bg-purple-500 rounded" onClick={ocr}>AI OCR O'qish</button>
      </div>
      
      <pre className="text-xs bg-black p-4 rounded text-emerald-400 border border-zinc-700 h-96 overflow-auto">
        {JSON.stringify(fakturalar, null, 2)}
      </pre>
    </div>
  );
}
