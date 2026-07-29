import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface Obyektlar3DProps {
  data: any[];
}

function BarChart({ data }: { data: any[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    if (!meshRef.current || data.length === 0) return;
    const dummy = new THREE.Object3D();
    const count = data.length;
    
    // Grid layout for bars
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 2;
    const offset = (cols * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const item = data[i];
      const height = Math.max(1, (item.smeta || 0) / 1000000000); // Scale down to reasonable height
      
      const x = (i % cols) * spacing - offset;
      const z = Math.floor(i / cols) * spacing - offset;
      
      dummy.position.set(x, height / 2, z);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Set color (fakt progress could determine color)
      const color = new THREE.Color(hovered === i ? '#4F7BFF' : '#2c303a');
      meshRef.current.setColorAt(i, color);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [data, hovered]);

  // Handle intersection for hover tooltip
  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      setHovered(e.instanceId);
    }
  };

  const handlePointerOut = () => {
    setHovered(null);
  };

  return (
    <group>
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, data.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial metalness={0.5} roughness={0.5} />
      </instancedMesh>
      
      {hovered !== null && data[hovered] && (
        <Html position={[
          ((hovered % Math.ceil(Math.sqrt(data.length))) * 2 - Math.ceil(Math.sqrt(data.length))), 
          Math.max(1, (data[hovered].smeta || 0) / 1000000000) + 1, 
          Math.floor(hovered / Math.ceil(Math.sqrt(data.length))) * 2 - Math.ceil(Math.sqrt(data.length))
        ]}>
          <div className="bg-glass backdrop-blur-md text-white p-2 rounded shadow-lg border border-glass-border text-sm pointer-events-none whitespace-nowrap">
            <div className="font-bold">{data[hovered].nomi || 'Nomsiz obyekt'}</div>
            <div className="text-text-dim text-xs mt-1">Smeta: {((data[hovered].smeta || 0) / 1e9).toFixed(2)} mlrd</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function SceneControls() {
  const { camera } = useThree();
  
  useFrame(() => {
    // simple slow rotation for showcase
    const time = Date.now() * 0.0001;
    camera.position.x = Math.sin(time) * 30;
    camera.position.z = Math.cos(time) * 30;
    camera.lookAt(0, 0, 0);
  });
  
  return null;
}

export default function Obyektlar3D({ data }: Obyektlar3DProps) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas
        camera={{ position: [30, 20, 30], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: false }}
        frameloop="demand" // Only render on demand or change
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-10, 5, -10]} intensity={0.5} color="#4F7BFF" />
        <BarChart data={data} />
        <SceneControls />
      </Canvas>
    </div>
  );
}
