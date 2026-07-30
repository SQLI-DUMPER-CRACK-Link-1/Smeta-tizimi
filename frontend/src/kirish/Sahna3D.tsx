import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function Karkas() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 60;

  // Generate random positions and scales for the beams
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50
      );
      
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
      );
      
      // Some are long and thin, some are thick
      const isVertical = Math.random() > 0.5;
      dummy.scale.set(
        isVertical ? 0.3 : 10 + Math.random() * 25,
        isVertical ? 10 + Math.random() * 25 : 0.3,
        0.3
      );
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.03;
      meshRef.current.rotation.x += delta * 0.015;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial 
        color="#0f172a" 
        metalness={0.95} 
        roughness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        emissive="#0ea5e9"
        emissiveIntensity={0.15}
      />
    </instancedMesh>
  );
}

// --- HAShAMATLI OLTIN ZARRACHALAR (Gold Particles) ---
function Zarrachalar() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 200;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(0.05 + Math.random() * 0.15);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y -= delta * 0.02;
      meshRef.current.rotation.x -= delta * 0.01;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial 
        color="#d4af37" 
        metalness={1} 
        roughness={0.2}
        emissive="#d4af37"
        emissiveIntensity={0.5}
      />
    </instancedMesh>
  );
}

function ParallaxCamera() {
  const { camera } = useThree();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    // lerp camera position slightly based on mouse
    const targetX = mouse.x * 3;
    const targetY = mouse.y * 3;
    
    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.06;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export default function Sahna3D() {
  return (
    <Canvas 
      camera={{ position: [0, 0, 30], fov: 45 }}
      dpr={[1, 1.5]} // cap dpr at 1.5 for performance
      gl={{ powerPreference: "high-performance", antialias: false }}
    >
      <color attach="background" args={['#020617']} />
      <fogExp2 attach="fog" args={['#020617', 0.025]} />
      
      <ambientLight intensity={0.4} />
      {/* Luxurious cyan rim light */}
      <directionalLight position={[15, 20, 5]} color="#0ea5e9" intensity={3} />
      {/* Golden warm light from below */}
      <directionalLight position={[-15, -20, -5]} color="#d4af37" intensity={2} />
      {/* Soft fill light */}
      <pointLight position={[0, 0, 10]} color="#ffffff" intensity={0.5} />
      
      <Karkas />
      <Zarrachalar />
      <ParallaxCamera />
    </Canvas>
  );
}
