import { useEffect, useRef } from "react";
import type { WebGLRenderer } from "three";

// Both layers share a star field. Nearby grains have wider halos and drift
// further with the pointer, while the distant stars anchor the nebula.
const vertexShader = `
  attribute float seed;
  attribute vec3 tint;
  uniform float time;
  uniform float pixelRatio;
  uniform vec2 pointer;
  varying vec3 starColor;
  varying float intensity;
  void main() {
    vec3 p = position;
    float depth = (p.z + 4.0) / 8.0;
    p.y += 0.10 * sin(p.x * 0.8 + time * 0.14 + p.z);
    p.x += 0.09 * cos(p.y + time * 0.09);
    p.xy += pointer * depth * 0.12;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp((1.3 + 8.0 * pow(seed, 5.0)) * 5.0 / -view.z, 1.0, 11.0) * pixelRatio;
    starColor = tint;
    intensity = (0.52 + 0.28 * sin(seed * 239.0 + time * (0.45 + seed))) + 0.18 * depth;
  }`;
const fragmentShader = `
  varying vec3 starColor;
  varying float intensity;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    float halo = exp(-4.0 * radius * radius) * (1.0 - smoothstep(0.72, 1.0, radius));
    gl_FragColor = vec4(starColor, halo * intensity);
  }`;

export default function GenerativeArtSceneV3() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;

    async function initialize(container: HTMLDivElement) {
      const THREE = await import("three");
      if (cancelled) return;
      let renderer: WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "low-power" });
      } catch {
        return; // The static stardust beneath the canvas remains visible.
      }
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 40);
      camera.position.z = 7;
      const count = container.clientWidth < 700 ? 5500 : 15500;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const seeds = new Float32Array(count);
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 30;
        const z = (Math.random() - 0.5) * 8;
        // Thread a denser diagonal current through the scattered dust.
        const y = i % 3 === 0
          ? 1.2 * Math.sin(x * 0.43 + z * 0.22) + x * 0.17 + (Math.random() - Math.random()) * 1.6
          : (Math.random() - 0.5) * 14;
        positions.set([x, y, z], i * 3);
        seeds[i] = Math.random();
        color.setHSL(0.52 + 0.20 * Math.random(), 0.68, 0.60 + seeds[i] * 0.31);
        color.toArray(colors, i * 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
      geometry.setAttribute("tint", new THREE.BufferAttribute(colors, 3));
      const uniforms = { time: { value: 0 }, pixelRatio: { value: 1 }, pointer: { value: new THREE.Vector2() } };
      const material = new THREE.ShaderMaterial({
        uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(geometry, material));
      container.appendChild(renderer.domElement);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const target = new THREE.Vector2();
      let frame = 0;
      let previous = 0;
      function draw(now: number) {
        frame = 0;
        if (document.hidden) return;
        const delta = previous ? Math.min((now - previous) / 1000, 0.06) : 0;
        previous = now;
        if (!reduced.matches) {
          uniforms.time.value += delta;
          uniforms.pointer.value.lerp(target, 1 - Math.exp(-delta * 3));
        }
        renderer.render(scene, camera);
        if (!reduced.matches) frame = requestAnimationFrame(draw);
      }
      function refresh() {
        cancelAnimationFrame(frame);
        previous = 0;
        draw(performance.now());
      }
      function resize() {
        const width = container.clientWidth, height = container.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 1.5);
        renderer.setPixelRatio(uniforms.pixelRatio.value);
        renderer.setSize(width, height);
        refresh();
      }
      function move(event: PointerEvent) {
        if (event.pointerType === "mouse") target.set(event.clientX / innerWidth * 2 - 1, 1 - event.clientY / innerHeight * 2);
      }
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("visibilitychange", refresh);
      reduced.addEventListener("change", refresh);
      resize();
      dispose = () => {
        observer.disconnect();
        window.removeEventListener("pointermove", move);
        document.removeEventListener("visibilitychange", refresh);
        reduced.removeEventListener("change", refresh);
        cancelAnimationFrame(frame);
        geometry.dispose(); material.dispose(); renderer.dispose();
        renderer.forceContextLoss(); renderer.domElement.remove();
      };
    }
    void initialize(host).catch(() => { /* Keep the static field if the renderer cannot load. */ });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return <div ref={mount} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{
    backgroundImage: "radial-gradient(1px 1px at 19% 37%, #bedcffb3 70%, transparent), radial-gradient(1.5px 1.5px at 73% 21%, #d0ccff99 60%, transparent), radial-gradient(1px 1px at 43% 81%, #97d6ff99 70%, transparent)",
    backgroundSize: "113px 167px, 219px 183px, 157px 137px",
  }} />;
}
