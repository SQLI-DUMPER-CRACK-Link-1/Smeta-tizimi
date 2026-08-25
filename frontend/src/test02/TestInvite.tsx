import { sbTaklifYubor } from '../api/t2-invite';

export default function TestInvite() {
  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Hamkorlik / Takliflar</h1>
      <button className="bg-sky-600 px-4 py-2" onClick={() => sbTaklifYubor('subpudrat@misol.uz', 'subpudrat')}>Taklif Yuborish</button>
    </div>
  );
}
