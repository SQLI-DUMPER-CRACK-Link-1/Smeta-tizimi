
import { sbOqi } from '../api/supabase';

export function DebugDb() {
  const check = async () => {
    const r = await sbOqi({ jadval: 't2_qator_holat', filtr: 'obyekt_id=gt.0', limit: 1 });
    console.log('t2_qator_holat:', r);
    const r2 = await sbOqi({ jadval: 't2_daraxt', filtr: 'obyekt_id=gt.0', limit: 1 });
    console.log('t2_daraxt:', r2);
  };
  return <button onClick={check} className="p-2 bg-blue-500 text-white rounded">Check DB</button>;
}

