import { useEffect, useRef } from 'react';

const LoginSignalScene = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let cleanupScene: (() => void) | null = null;

    const startScene = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const THREE = await import('three');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.2, 2.6));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0.15, 8.2);

      const root = new THREE.Group();
      scene.add(root);

      const ambient = new THREE.AmbientLight(0x9dd8ff, 1.4);
      const keyLight = new THREE.PointLight(0x7dd3fc, 45, 18);
      keyLight.position.set(-3, 2.5, 4);
      const rimLight = new THREE.PointLight(0xa78bfa, 28, 18);
      rimLight.position.set(3, -1.4, 3.5);
      scene.add(ambient, keyLight, rimLight);

      const shellMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xdff7ff,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.22,
        roughness: 0.18,
        metalness: 0.12,
        transmission: 0.34,
        thickness: 0.8,
        transparent: true,
        opacity: 0.42,
      });
      const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.42,
        wireframe: true,
      });
      const haloMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 4), shellMaterial);
      const wireCore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.17, 2), wireMaterial);
      const innerHalo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.012, 12, 160), haloMaterial);
      const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.01, 12, 180), haloMaterial.clone());
      innerHalo.rotation.set(0.8, 0.25, 0.2);
      outerHalo.rotation.set(-0.65, 0.35, 0.85);
      root.add(core, wireCore, innerHalo, outerHalo);

      const particleCount = 520;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const colorA = new THREE.Color(0x7dd3fc);
      const colorB = new THREE.Color(0xc4b5fd);

      for (let index = 0; index < particleCount; index += 1) {
        const angle = index * 0.34;
        const radius = 2.4 + Math.sin(index * 0.17) * 1.1 + Math.random() * 1.2;
        const layer = (index % 7) - 3;
        particlePositions[index * 3] = Math.cos(angle) * radius;
        particlePositions[index * 3 + 1] = layer * 0.22 + Math.sin(angle * 1.7) * 0.35;
        particlePositions[index * 3 + 2] = Math.sin(angle) * radius * 0.42 - 1.2 + Math.random() * 1.2;

        const mixed = colorA.clone().lerp(colorB, (index % 17) / 17);
        particleColors[index * 3] = mixed.r;
        particleColors[index * 3 + 1] = mixed.g;
        particleColors[index * 3 + 2] = mixed.b;
      }

      const particlesGeometry = new THREE.BufferGeometry();
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particlesGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
      const particles = new THREE.Points(
        particlesGeometry,
        new THREE.PointsMaterial({
          size: 0.038,
          vertexColors: true,
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      root.add(particles);

      const arcMaterial = new THREE.MeshBasicMaterial({
        color: 0xbae6fd,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const arcs: InstanceType<typeof THREE.Mesh>[] = [];
      for (let index = 0; index < 8; index += 1) {
        const radius = 2.6 + index * 0.24;
        const curve = new THREE.CatmullRomCurve3(
          Array.from({ length: 44 }, (_, step) => {
            const progress = step / 43;
            const angle = progress * Math.PI * 1.34 + index * 0.58;
            return new THREE.Vector3(
              Math.cos(angle) * radius,
              Math.sin(progress * Math.PI) * (0.45 + index * 0.03) - 0.12,
              Math.sin(angle) * radius * 0.28 - 1.5,
            );
          }),
        );
        const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.008, 6, false), arcMaterial.clone());
        arc.rotation.z = index * 0.34;
        arc.rotation.x = -0.18 + index * 0.035;
        arcs.push(arc);
        root.add(arc);
      }

      const resize = () => {
        const { clientWidth, clientHeight } = canvas;
        renderer.setSize(clientWidth, clientHeight, false);
        camera.aspect = clientWidth / Math.max(clientHeight, 1);
        camera.updateProjectionMatrix();
      };

      const clock = new THREE.Clock();
      const animate = () => {
        const elapsed = clock.getElapsedTime();
        root.rotation.y = elapsed * 0.08;
        root.rotation.x = Math.sin(elapsed * 0.24) * 0.08;
        core.rotation.y = elapsed * 0.2;
        core.rotation.z = Math.sin(elapsed * 0.34) * 0.12;
        wireCore.rotation.y = -elapsed * 0.14;
        innerHalo.rotation.z = elapsed * 0.28;
        outerHalo.rotation.z = -elapsed * 0.18;
        particles.rotation.y = elapsed * 0.05;
        arcs.forEach((arc, index) => {
          arc.rotation.z += 0.0015 + index * 0.00018;
        });

        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(animate);
      };

      resize();
      window.addEventListener('resize', resize);
      frameId = window.requestAnimationFrame(animate);

      cleanupScene = () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
        scene.traverse((object) => {
          const mesh = object as typeof object & {
            geometry?: { dispose: () => void };
            material?: { dispose: () => void } | Array<{ dispose: () => void }>;
          };
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material.dispose());
          } else {
            mesh.material?.dispose();
          }
        });
        renderer.dispose();
      };
    };

    startScene();

    return () => {
      cancelled = true;
      cleanupScene?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-90"
    />
  );
};

export default LoginSignalScene;
