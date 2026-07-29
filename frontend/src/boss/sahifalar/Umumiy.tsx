import { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBossData } from '../../api/hooks';
import { FmtN, formatPercent } from '../../lib/format';
import { MalumotYoshi, Skelet, XatoHolat } from '../../umumiy/ui/Sahifa';
import { Canvas } from '@react-three/fiber';
import { Html, Environment, ContactShadows, Bounds, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { RefreshCw, LayoutDashboard, TrendingUp, Wallet, CheckCircle, Clock } from 'lucide-react';

// --- 3D Obyektlar Komponenti ---
function CityScene({ objects, onSelect }: { objects: any[], onSelect: (nom: string) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  // Obyektlarni kvadrat to'rga (grid) joylash
  const count = objects.length;
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = 4;
  const offset = (cols * spacing) / 2 - (spacing / 2);
  
  // Eng katta smeta ni topish (balandlikni normallashtirish uchun)
  const maxSmeta = useMemo(() => Math.max(1, ...objects.map(o => o.smeta || 0)), [objects]);

  useMemo(() => {
    if (!meshRef.current || !glowRef.current) return;
    const dummy = new THREE.Object3D();
    const glowDummy = new THREE.Object3D();
    
    for (let i = 0; i < count; i++) {
      const obj = objects[i];
      // Balandlik 1 dan 10 gacha
      const h = Math.max(0.5, ((obj.smeta || 0) / maxSmeta) * 10);
      const x = (i % cols) * spacing - offset;
      const z = Math.floor(i / cols) * spacing - offset;
      
      // Asosiy bino (Smeta)
      dummy.position.set(x, h / 2, z);
      dummy.scale.set(1.5, h, 1.5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Fakt progress bo'yicha rang
      const pct = obj.progress || 0;
      const baseColor = pct > 90 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444';
      const color = new THREE.Color(hovered === i ? '#4F7BFF' : '#2A2D35');
      meshRef.current.setColorAt(i, color);

      // Ichki Fakt (Glow/Yorug'lik)
      const faktH = Math.max(0.01, h * (pct / 100));
      glowDummy.position.set(x, faktH / 2, z);
      glowDummy.scale.set(1.52, faktH, 1.52);
      glowDummy.updateMatrix();
      glowRef.current.setMatrixAt(i, glowDummy.matrix);
      glowRef.current.setColorAt(i, new THREE.Color(baseColor));
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    
    glowRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current.instanceColor) glowRef.current.instanceColor.needsUpdate = true;
    
  }, [objects, maxSmeta, hovered, cols, offset, spacing, count]);

  return (
    <group>
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, count]}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) setHovered(e.instanceId);
        }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onSelect(objects[e.instanceId].nom);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fff" roughness={0.2} metalness={0.8} />
      </instancedMesh>
      
      <instancedMesh ref={glowRef} args={[undefined, undefined, count]} renderOrder={1}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.6} />
      </instancedMesh>

      {/* Tooltip */}
      {hovered !== null && objects[hovered] && (
        <Html 
          position={[
            (hovered % cols) * spacing - offset, 
            (((objects[hovered].smeta || 0) / maxSmeta) * 10) + 1, 
            Math.floor(hovered / cols) * spacing - offset
          ]}
          center
          zIndexRange={[100, 0]}
        >
          <div className="bg-[#1C1F26]/80 backdrop-blur-md border border-[var(--glass-border)] p-4 rounded-xl shadow-2xl pointer-events-none min-w-[200px] text-white">
            <h3 className="font-bold text-lg mb-2">{objects[hovered].nom}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-text-dim">Smeta:</span>
                <span className="font-mono"><FmtN val={objects[hovered].smeta} /></span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-dim">Fakt:</span>
                <span className="font-mono text-ok"><FmtN val={objects[hovered].fakt} /></span>
              </div>
              <div className="mt-2 pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
                <span className="text-text-dim">Bajarilish:</span>
                <span className={`font-bold ${objects[hovered].progress > 90 ? 'text-ok' : 'text-warn'}`}>
                  {formatPercent(objects[hovered].progress)}
                </span>
              </div>
            </div>
            <div className="mt-3 text-center text-[10px] text-accent uppercase tracking-wider font-semibold animate-pulse">
              Batafsil ko'rish uchun bosing
            </div>
          </div>
        </Html>
      )}

      {/* Zamin (Yer) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0A0B10" roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Reflection Shadow */}
      <ContactShadows resolution={1024} scale={50} blur={2} opacity={0.5} far={10} color="#000000" />
    </group>
  );
}

// --- Sahifa qobig'i ---
export default function Umumiy() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useBossData();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-bg">
        <div className="max-w-4xl w-full">
           <Skelet qatorlar={5} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <XatoHolat xato={error || new Error("Ma'lumot yo'q")} qayta={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#05050A] overflow-hidden font-sans">
      {/* 3D Orqa fon */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 15, 25], fov: 45 }}>
          <fog attach="fog" args={['#05050A', 20, 60]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
          <pointLight position={[-10, 5, -10]} intensity={2} color="#4F7BFF" />
          <pointLight position={[10, 5, 10]} intensity={1} color="#f59e0b" />
          
          <Bounds fit clip observe margin={1.2}>
            <CityScene objects={data.objects || []} onSelect={(nom) => navigate('/boss/holat/' + nom)} />
          </Bounds>
          
          <OrbitControls 
            makeDefault 
            autoRotate 
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 6} 
            maxPolarAngle={Math.PI / 2.1} 
            enablePan={false}
          />
          <Environment preset="city" />
        </Canvas>
      </div>

      {/* Glassmorphism UI (Ustidan tushadi) */}
      <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
        {/* Header */}
        <header className="flex justify-between items-start">
          <div className="bg-[#1C1F26]/70 backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl p-5 shadow-2xl pointer-events-auto">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <LayoutDashboard className="text-accent" size={28} />
              Boshqaruv Paneli
            </h1>
            <p className="text-text-dim text-sm mt-1 flex items-center gap-2">
              Jami {data.objects?.length || 0} ta obyekt fazosi
              {dataUpdatedAt && (
                <>
                  <span className="w-1 h-1 bg-text-mute rounded-full"></span>
                  <MalumotYoshi vaqt={dataUpdatedAt} />
                </>
              )}
            </p>
          </div>
          
          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="pointer-events-auto bg-[#1C1F26]/70 backdrop-blur-xl border border-[var(--glass-border)] text-white h-12 px-6 rounded-xl flex items-center gap-2 hover:bg-white/10 transition-colors shadow-lg"
          >
            <RefreshCw size={18} className={isFetching ? 'animate-spin text-accent' : ''} />
            Yangilash
          </button>
        </header>

        {/* KPI Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pointer-events-auto max-w-6xl"
        >
          <div className="bg-[#1C1F26]/80 backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-accent/50 transition-colors">
             <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-accent transition-transform group-hover:scale-150" />
             <p className="text-text-dim text-sm font-medium mb-1 flex items-center gap-2"><Wallet size={16} /> Smeta Jami</p>
             <div className="text-2xl font-bold text-white font-mono mt-2"><FmtN val={data.jami.smeta} /></div>
             <p className="text-xs text-text-dim mt-2">So'm</p>
          </div>
          
          <div className="bg-[#1C1F26]/80 backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-ok/50 transition-colors">
             <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-ok transition-transform group-hover:scale-150" />
             <p className="text-text-dim text-sm font-medium mb-1 flex items-center gap-2"><TrendingUp size={16} /> Bajarilgan (Fakt)</p>
             <div className="text-2xl font-bold text-white font-mono mt-2"><FmtN val={data.jami.fakt} /></div>
             <div className="mt-2 w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div className="h-full bg-ok rounded-full" style={{ width: `${Math.min(data.jami.progress, 100)}%` }} />
             </div>
             <p className="text-xs text-ok mt-1">{formatPercent(data.jami.progress)} bajarildi</p>
          </div>

          <div className="bg-[#1C1F26]/80 backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-t-rs/50 transition-colors">
             <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-t-rs transition-transform group-hover:scale-150" />
             <p className="text-text-dim text-sm font-medium mb-1 flex items-center gap-2"><CheckCircle size={16} /> Tasdiqlangan (F2)</p>
             <div className="text-2xl font-bold text-white font-mono mt-2"><FmtN val={data.jami.f2} /></div>
             <div className="mt-2 w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div className="h-full bg-t-rs rounded-full" style={{ width: `${Math.min(data.jami.f2pct, 100)}%` }} />
             </div>
             <p className="text-xs text-t-rs mt-1">{formatPercent(data.jami.f2pct)} hujjatlashtirildi</p>
          </div>

          <div className="bg-[#1C1F26]/80 backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-warn/50 transition-colors">
             <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-warn transition-transform group-hover:scale-150" />
             <p className="text-text-dim text-sm font-medium mb-1 flex items-center gap-2"><Clock size={16} /> Qoldiq</p>
             <div className="text-2xl font-bold text-white font-mono mt-2"><FmtN val={data.jami.qoldiq} /></div>
             <p className="text-xs text-text-dim mt-2">Bajarilmagan hajm</p>
          </div>
        </motion.div>
      </div>
      
      {/* Qopqoq overlay qismiga CSS klasslari qo'shilmasligi uchun, yordamchi instruction matni: */}
      <div className="absolute bottom-6 right-6 z-10 pointer-events-none">
         <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs text-white/50 font-mono">
            Sichqoncha bilan aylantiring | Obyektga kiring
         </div>
      </div>
    </div>
  );
}
