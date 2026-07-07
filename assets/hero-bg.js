// Faint dotted world map behind the hero, with pulses traveling the
// China -> overseas trade routes. Decorative only: skipped for reduced
// motion, small screens, missing WebGL, or a failed CDN load.
import MAP_DOTS from "./map-dots.js";

(async () => {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.innerWidth < 700) return;

  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
  } catch {
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  // Camera lives in lon/lat space; bounds recomputed on resize to cover the hero.
  const MAP = { left: -180, right: 180, top: 75, bottom: -60 };
  const camera = new THREE.OrthographicCamera(MAP.left, MAP.right, MAP.top, MAP.bottom, -10, 10);

  // Land dots
  const positions = new Float32Array((MAP_DOTS.length / 2) * 3);
  for (let i = 0, j = 0; i < MAP_DOTS.length; i += 2, j += 3) {
    positions[j] = MAP_DOTS[i];
    positions[j + 1] = MAP_DOTS[i + 1];
    positions[j + 2] = 0;
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(
    new THREE.Points(
      dotGeo,
      new THREE.PointsMaterial({ color: 0xc3cedb, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.55 })
    )
  );

  // Trade routes: [from lon, lat] -> [to lon, lat], arched via a raised midpoint.
  const ROUTES = [
    { from: [121.47, 31.23], to: [4.48, 51.92] },   // Shanghai -> Rotterdam
    { from: [114.06, 22.54], to: [55.03, 25.0] },   // Shenzhen -> Dubai
    { from: [121.47, 31.23], to: [-74.0, 40.71] },  // Shanghai -> New York
  ];
  const routeMat = new THREE.LineBasicMaterial({ color: 0x1e4e79, transparent: true, opacity: 0.14 });
  const endMat = new THREE.MeshBasicMaterial({ color: 0x1e4e79, transparent: true, opacity: 0.35 });
  const endGeo = new THREE.CircleGeometry(1.1, 16);
  const curves = ROUTES.map(({ from, to }) => {
    const mid = new THREE.Vector3(
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 24,
      0
    );
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from[0], from[1], 0),
      mid,
      new THREE.Vector3(to[0], to[1], 0)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    scene.add(new THREE.Line(geo, routeMat));
    for (const [x, y] of [from, to]) {
      const m = new THREE.Mesh(endGeo, endMat);
      m.position.set(x, y, 1);
      scene.add(m);
    }
    return curve;
  });

  // Pulses along the routes
  const pulseGeo = new THREE.CircleGeometry(1.4, 16);
  const pulses = [];
  curves.forEach((curve, ci) => {
    for (let k = 0; k < 2; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1e4e79, transparent: true });
      const mesh = new THREE.Mesh(pulseGeo, mat);
      mesh.position.z = 2;
      scene.add(mesh);
      pulses.push({ mesh, mat, curve, t: (ci * 0.23 + k * 0.5) % 1, speed: 0.045 + 0.012 * ci });
    }
  });

  const canvas = renderer.domElement;
  canvas.className = "hero-bg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);

  const resize = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    // Cover: keep lon span fixed, crop/extend latitude to match the hero aspect.
    const lonSpan = 360;
    const latSpan = lonSpan * (h / w);
    const latMid = 26; // bias toward the northern hemisphere, where the routes run
    camera.left = -180;
    camera.right = 180;
    camera.top = latMid + latSpan / 2;
    camera.bottom = latMid - latSpan / 2;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(hero);

  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(hero);

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      pulses.forEach((p) => {
        p.t = (p.t + p.speed * dt) % 1;
        const pt = p.curve.getPointAt(p.t);
        p.mesh.position.x = pt.x;
        p.mesh.position.y = pt.y;
        const fade = Math.min(p.t / 0.12, (1 - p.t) / 0.12, 1);
        p.mat.opacity = 0.55 * Math.max(fade, 0);
      });
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
