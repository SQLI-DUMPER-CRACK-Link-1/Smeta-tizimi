import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { MeshTransmissionMaterial, Environment, Float, Sphere, CameraShake } from '@react-three/drei';

function LuxCrystal() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.15;
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={2}>
      <mesh ref={meshRef} scale={10}>
        <torusKnotGeometry args={[1, 0.4, 256, 64]} />
        <MeshTransmissionMaterial 
          backside
          backsideThickness={5}
          thickness={2}
          chromaticAberration={0.4}
          anisotropy={0.5}
          distortion={0.5}
          distortionScale={0.5}
          temporalDistortion={0.1}
          color="#0ea5e9"
          resolution={1024}
        />
      </mesh>
    </Float>
  );
}

function GlowingOrbs() {
  const orb1 = useRef<THREE.Mesh>(null);
  const orb2 = useRef<THREE.Mesh>(null);
  const orb3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (orb1.current) {
      orb1.current.position.x = Math.sin(t * 0.5) * 15;
      orb1.current.position.y = Math.cos(t * 0.5) * 15;
      orb1.current.position.z = -10;
    }
    if (orb2.current) {
      orb2.current.position.x = Math.cos(t * 0.4) * -20;
      orb2.current.position.y = Math.sin(t * 0.4) * 15;
      orb2.current.position.z = -15;
    }
    if (orb3.current) {
      orb3.current.position.x = Math.sin(t * 0.3) * 20;
      orb3.current.position.y = Math.cos(t * 0.3) * -15;
      orb3.current.position.z = -20;
    }
  });

  return (
    <>
      <Sphere ref={orb1} args={[4, 32, 32]}>
        <meshBasicMaterial color="#0ea5e9" />
      </Sphere>
      <Sphere ref={orb2} args={[6, 32, 32]}>
        <meshBasicMaterial color="#d4af37" />
      </Sphere>
      <Sphere ref={orb3} args={[5, 32, 32]}>
        <meshBasicMaterial color="#8b5cf6" />
      </Sphere>
    </>
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
        emissiveIntensity={3.0}
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

  return <CameraShake maxPitch={0.02} maxRoll={0.02} maxYaw={0.02} yawFrequency={0.2} pitchFrequency={0.2} rollFrequency={0.2} intensity={0.5} />;
}

// --- INTERAKTIV SICHQONCHA NURI (Pointer Orb) ---
function PointerLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, mouse } = useThree();
  
  useFrame(() => {
    if (lightRef.current && meshRef.current) {
      const x = (mouse.x * viewport.width) / 2;
      const y = (mouse.y * viewport.height) / 2;
      // Silliq harakat (Lerp)
      lightRef.current.position.lerp(new THREE.Vector3(x, y, 8), 0.1);
      meshRef.current.position.lerp(new THREE.Vector3(x, y, 8), 0.1);
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} distance={20} intensity={5} color="#0ea5e9" />
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

export default function Sahna3D() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return null;
  }

  return (
    <Canvas 
      camera={{ position: [0, 0, 30], fov: 45 }}
      dpr={[1, 1.5]} // cap dpr at 1.5 for performance
      gl={{ powerPreference: "high-performance", antialias: false }}
    >
      <color attach="background" args={['#020617']} />
      <fogExp2 attach="fog" args={['#020617', 0.025]} />
      
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 10]} intensity={2} color="#ffffff" />
      <directionalLight position={[-10, -10, -10]} intensity={1} color="#0ea5e9" />
      
      <LuxCrystal />
      <GlowingOrbs />
      <Zarrachalar />
      <ParallaxCamera />
      <PointerLight />
      
      <Environment preset="city" />

      {/* Cinematic Post Processing */}
      <EffectComposer>
        <Bloom 
          luminanceThreshold={0.5} 
          mipmapBlur 
          intensity={1.5} 
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.002, 0.002)}
        />
        <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.3} />
        <Vignette eskil={false} offset={0.1} darkness={1.2} />
      </EffectComposer>
    </Canvas>
  );
}
