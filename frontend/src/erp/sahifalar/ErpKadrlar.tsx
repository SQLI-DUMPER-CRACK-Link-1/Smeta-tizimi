

export default function ErpKadrlar() {
  return (
    <div className="p-8 text-white h-full overflow-auto">
      <h1 className="text-3xl font-bold mb-4">Kadrlar va Tabel (Davomat)</h1>
      <p className="text-slate-400 mb-8">Bu bo'limda obyektlardagi jami ishchilar, ularning kunlik ishlagan soatlari (davomat) va brigadalar hisoboti yuritiladi.</p>
      
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center h-64">
        <div className="text-4xl mb-4">👷‍♂️</div>
        <h3 className="text-xl font-bold">Kadrlar moduli tez orada...</h3>
        <p className="text-slate-500 mt-2 text-center max-w-md">Backendda kadrlar (HR) tizimi ulanmoqda. Bu yerda ishchilar qabuli va maoshlar tabeli ko'rsatiladi.</p>
      </div>
    </div>
  );
}
