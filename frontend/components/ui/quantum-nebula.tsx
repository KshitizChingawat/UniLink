import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// --- CONFIGURATION OBJECT V4.0 ---
// Enhanced for a more dramatic, cool visual effect
const config = {
    particles: {
        count: 65000, // Increased particle count for denser effect
        size: 0.016,
        boxSize: 8,  // Larger volume
    },
    colors: {
        baseHue: 200,
        hueVariance: 60,  // Wider color range (cyan, blue, purple, magenta)
        saturation: 0.95,
        lightness: 0.65,
    },
    simulation: {
        noiseSpeed: 0.07,
        noiseScale: 1.1,
        mouseRepulsion: 0.008,
        friction: 0.93,
        // Swirling clusters
        swirlStrength: 0.012,
    },
    bloom: {
        strength: 1.8,  // Stronger glow
        radius: 0.8,    // Wider bloom spread
        threshold: 0.05, // Lower threshold for more glow
    },
    camera: {
        initialDistance: 6,
        parallaxIntensity: 0.008,
        fov: 55,
    },
    // Color palette for gradient effect
    palette: {
        primary: 0x06b6d4,   // Cyan
        secondary: 0x8b5cf6, // Purple
        accent: 0xec4899,    // Pink/Magenta
    },
};

export default function GenerativeArtSceneV3() {
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const mouseRef = useRef(new THREE.Vector2(0, 0));
    const velocitiesRef = useRef<Float32Array | null>(null);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        const scene = new THREE.Scene();
        // Add nebula-like ambient lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        const camera = new THREE.PerspectiveCamera(config.camera.fov, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.z = config.camera.initialDistance;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current = renderer;
        currentMount.appendChild(renderer.domElement);

        const renderPass = new RenderPass(scene, camera);

        // Bloom pass for glow effect
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(currentMount.clientWidth, currentMount.clientHeight), config.bloom.strength, config.bloom.radius, config.bloom.threshold);
        bloomPass.resolution = new THREE.Vector2(currentMount.clientWidth / 1.5, currentMount.clientHeight / 1.5);

        // FXAA pass for anti-aliasing
        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.uniforms['resolution'].value.set(
            1 / (currentMount.clientWidth * window.devicePixelRatio),
            1 / (currentMount.clientHeight * window.devicePixelRatio)
        );

        const composer = new EffectComposer(renderer);
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
        composer.addPass(fxaaPass);
        composerRef.current = composer;

        const particleCount = config.particles.count;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3).fill(0);
        velocitiesRef.current = velocities;
        const baseColor = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * config.particles.boxSize;
            positions[i3 + 1] = (Math.random() - 0.5) * config.particles.boxSize;
            positions[i3 + 2] = (Math.random() - 0.5) * config.particles.boxSize;

            const hue = (config.colors.baseHue + (Math.random() - 0.5) * config.colors.hueVariance) / 360;
            baseColor.setHSL(hue, 1.0, 0.6);
            colors[i3] = baseColor.r;
            colors[i3 + 1] = baseColor.g;
            colors[i3 + 2] = baseColor.b;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_pointSize: { value: config.particles.size * renderer.getPixelRatio() }
            },
            vertexShader: `
                attribute vec3 color;
                varying vec3 vColor;
                uniform float u_pointSize;

                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = u_pointSize * (10.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float strength = distance(gl_PointCoord, vec2(0.5));
                    strength = 1.0 - step(0.5, strength);
                    if (strength < 0.01) discard;
                    gl_FragColor = vec4(vColor, strength);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particleSystem);

        // Add a secondary, smaller particle system for depth
        const secondaryCount = 8000;
        const secondaryPositions = new Float32Array(secondaryCount * 3);
        const secondaryColors = new Float32Array(secondaryCount * 3);
        const secondaryGeometry = new THREE.BufferGeometry();

        const secondaryColor = new THREE.Color();
        for (let i = 0; i < secondaryCount; i++) {
            const i3 = i * 3;
            // Distribute secondary particles in a sphere
            const radius = config.particles.boxSize * 0.4 * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            secondaryPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            secondaryPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            secondaryPositions[i3 + 2] = radius * Math.cos(phi);

            const hue = (config.colors.baseHue + (Math.random() - 0.5) * config.colors.hueVariance) / 360;
            secondaryColor.setHSL(hue, config.colors.saturation, config.colors.lightness * 1.2);
            secondaryColors[i3] = secondaryColor.r;
            secondaryColors[i3 + 1] = secondaryColor.g;
            secondaryColors[i3 + 2] = secondaryColor.b;
        }
        secondaryGeometry.setAttribute('position', new THREE.BufferAttribute(secondaryPositions, 3));
        secondaryGeometry.setAttribute('color', new THREE.BufferAttribute(secondaryColors, 3));

        const secondaryMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0 },
                u_pointSize: { value: config.particles.size * 3.2 * renderer.getPixelRatio() },
            },
            vertexShader: `
                attribute vec3 color;
                varying vec3 vColor;
                uniform float u_pointSize;
                uniform float u_time;
                void main() {
                    vColor = color;
                    float wave = sin(u_time * 0.5 + position.x * 0.5) * 0.1;
                    vec3 rotatedPosition = position;
                    rotatedPosition.x += wave;
                    vec4 mvPosition = modelViewMatrix * vec4(rotatedPosition, 1.0);
                    gl_PointSize = u_pointSize * (1.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    float strength = distance(gl_PointCoord, vec2(0.5));
                    strength = exp(-strength * 2.5);
                    if (strength < 0.001) discard;
                    gl_FragColor = vec4(vColor, strength * 0.6);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const secondaryParticles = new THREE.Points(secondaryGeometry, secondaryMaterial);
        scene.add(secondaryParticles);

        // Curl noise simulation function
        const curlNoiseFn = (p: THREE.Vector3, speed: number, scale: number) => {
            const noiseVec = new THREE.Vector3(
                Math.sin(p.y * scale + speed),
                Math.cos(p.z * scale + speed),
                Math.sin(p.x * scale + speed)
            ).normalize();
            return noiseVec;
        };

        let frameId: number;
        const clock = new THREE.Clock();

        const animate = () => {
            const elapsedTime = clock.getElapsedTime();
            const positionsAttr = particleSystem.geometry.attributes.position.array as Float32Array;
            const velocitiesArr = velocitiesRef.current;
            if (!velocitiesArr) return;

            // Update secondary particles
            secondaryMaterial.uniforms.u_time.value = elapsedTime;
            secondaryParticles.rotation.y = elapsedTime * 0.03;
            secondaryParticles.rotation.z = elapsedTime * 0.015;

            // Rotate the entire particle system slightly for dynamism
            particleSystem.rotation.y = elapsedTime * 0.005;
            particleSystem.rotation.x = Math.sin(elapsedTime * 0.1) * 0.02;

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                const p = new THREE.Vector3(positionsAttr[i3], positionsAttr[i3 + 1], positionsAttr[i3 + 2]);

                const curlForce = curlNoiseFn(p, elapsedTime * config.simulation.noiseSpeed, config.simulation.noiseScale);

                const mouseForce = new THREE.Vector3();
                const mouseTarget = new THREE.Vector3(mouseRef.current.x * (config.particles.boxSize / 2), mouseRef.current.y * (config.particles.boxSize / 2), 0);
                const distanceToMouse = p.distanceTo(mouseTarget);
                if (distanceToMouse < 2) {
                    mouseForce.subVectors(p, mouseTarget).normalize().multiplyScalar(1 / (distanceToMouse + 0.1));
                }

                velocitiesArr[i3] += (curlForce.x * 0.001 + mouseForce.x * config.simulation.mouseRepulsion);
                velocitiesArr[i3 + 1] += (curlForce.y * 0.001 + mouseForce.y * config.simulation.mouseRepulsion);
                velocitiesArr[i3 + 2] += (curlForce.z * 0.001 + mouseForce.z * config.simulation.mouseRepulsion);

                velocitiesArr[i3] *= config.simulation.friction;
                velocitiesArr[i3 + 1] *= config.simulation.friction;
                velocitiesArr[i3 + 2] *= config.simulation.friction;

                positionsAttr[i3] += velocitiesArr[i3];
                positionsAttr[i3 + 1] += velocitiesArr[i3 + 1];
                positionsAttr[i3 + 2] += velocitiesArr[i3 + 2];

                if (Math.abs(positionsAttr[i3]) > config.particles.boxSize / 2) positionsAttr[i3] *= -1;
                if (Math.abs(positionsAttr[i3+1]) > config.particles.boxSize / 2) positionsAttr[i3+1] *= -1;
                if (Math.abs(positionsAttr[i3+2]) > config.particles.boxSize / 2) positionsAttr[i3+2] *= -1;
            }

            particleSystem.geometry.attributes.position.needsUpdate = true;

            // Enhanced camera parallax with smooth follow
            camera.position.x += (mouseRef.current.x * config.camera.parallaxIntensity - camera.position.x) * 0.03;
            camera.position.y += (-mouseRef.current.y * config.camera.parallaxIntensity - camera.position.y) * 0.03;
            camera.lookAt(scene.position);

            composer.render();
            frameId = requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            const w = currentMount.clientWidth;
            const h = currentMount.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
            fxaaPass.material.uniforms['resolution'].value.set(
                1 / (w * window.devicePixelRatio),
                1 / (h * window.devicePixelRatio)
            );
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };

        window.addEventListener("resize", handleResize);
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouseMove);
            if (currentMount && renderer.domElement) {
                currentMount.removeChild(renderer.domElement);
            }
            particleGeometry.dispose();
            particleMaterial.dispose();
            secondaryGeometry.dispose();
            secondaryMaterial.dispose();
            composer.dispose();
        };
    }, []);

    return <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />;
}
