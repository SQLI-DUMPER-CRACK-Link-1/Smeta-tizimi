import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function Karkas() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const COUNT = 40;

  // Generate random positions and scales for the beams
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      );
      
      dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        0
      );
      
      // Some are long and thin, some are thick
      const isVertical = Math.random() > 0.5;
      dummy.scale.set(
        isVertical ? 0.4 : 10 + Math.random() * 20,
        isVertical ? 10 + Math.random() * 20 : 0.4,
        0.4
      );
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.05;
      meshRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial 
        color="#2c303a" 
        metalness={0.8} 
        roughness={0.35}
        emissive="#4F7BFF"
        emissiveIntensity={0.1}
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
      <color attach="background" args={['#131722']} />
      <fogExp2 attach="fog" args={['#131722', 0.035]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} color="#4F7BFF" intensity={2} />
      <directionalLight position={[-10, -10, -5]} color="#D97706" intensity={1} />
      
      <Karkas />
      <ParallaxCamera />
    </Canvas>
  );
}
