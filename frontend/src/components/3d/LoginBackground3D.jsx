import React, { useRef, useMemo, Component } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Float, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';

function StarField(props) {
    const ref = useRef();

    // Create 5000 random points in a sphere
    const sphere = useMemo(() => random.inSphere(new Float32Array(5000), { radius: 1.5 }), []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10;
            ref.current.rotation.y -= delta / 15;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#818cf8"
                    size={0.005}
                    sizeAttenuation={true}
                    depthWrite={false}
                />
            </Points>
        </group>
    );
}

function GlowingOrb() {
    return (
        <Float speed={2} rotationIntensity={1} floatIntensity={2}>
            <Sphere args={[0.5, 64, 64]}>
                <MeshDistortMaterial
                    color="#3b82f6"
                    attach="material"
                    distort={0.4}
                    speed={2}
                    roughness={0.2}
                    metalness={0.8}
                />
            </Sphere>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[-10, -10, -5]} color="#10b981" intensity={2} />
        </Float>
    );
}

// Error Boundary: if 3D crashes, show CSS gradient fallback
class ThreeErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error, errorInfo) {
        console.warn("3D background failed, using CSS fallback:", error);
    }
    render() {
        if (this.state.hasError) {
            return null; // Parent div already has bg color
        }
        return this.props.children;
    }
}

export default function LoginBackground3D() {
    return (
        <div className="absolute inset-0 w-full h-full bg-[#071325] overflow-hidden -z-10">
            <ThreeErrorBoundary>
                <Canvas camera={{ position: [0, 0, 1] }}>
                    <ambientLight intensity={0.5} />
                    <StarField />
                    <GlowingOrb />
                </Canvas>
            </ThreeErrorBoundary>
        </div>
    );
}
