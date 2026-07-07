// The hero's world map: a dotted land mask on the navy hero, with arced
// trade routes from China to Europe, the Gulf and the US, labeled cities,
// and pulses traveling the routes. Reduced-motion users get a static
// frame; missing WebGL or a failed CDN load leaves the hero text-only.
import MAP_DOTS from "./map-dots.js";

(async () => {
  const mount = document.querySelector(".hero-map");
  if (!mount) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Colors are CSS custom properties on .hero-map (or inherited) so the
  // palette can change without touching this file.
  const css = getComputedStyle(mount);
  const cvar = (name, fallback) => (css.getPropertyValue(name) || "").trim() || fallback;
  const DOT_COLOR = cvar("--map-dot", "#54779c");
  const DOT_ALPHA = parseFloat(cvar("--map-dot-alpha", "1"));
  const ROUTE_COLOR = cvar("--map-route", "#93c1ef");
  const ROUTE_ALPHA = parseFloat(cvar("--map-route-alpha", "0.5"));
  const PULSE_COLOR = cvar("--map-pulse", "#c4def7");
  const LABEL_COLOR = cvar("--map-label", "#cfe0f0");

  const zh = document.documentElement.lang.startsWith("zh");
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-180, 180, 75, -60, -10, 10);

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
      new THREE.PointsMaterial({
        color: new THREE.Color(DOT_COLOR),
        size: 3,
        sizeAttenuation: false,
        transparent: true,
        opacity: DOT_ALPHA,
      })
    )
  );

  // Cities and routes
  const CITIES = {
    shanghai: { lon: 121.47, lat: 31.23, label: zh ? "上海" : "Shanghai", dx: 4, dy: 6 },
    shenzhen: { lon: 114.06, lat: 22.54, label: zh ? "深圳" : "Shenzhen", dx: 2, dy: -8 },
    rotterdam: { lon: 4.48, lat: 51.92, label: zh ? "鹿特丹" : "Rotterdam", dx: -6, dy: 7 },
    dubai: { lon: 55.03, lat: 25.0, label: zh ? "迪拜" : "Dubai", dx: 3, dy: -8 },
    newyork: { lon: -74.0, lat: 40.71, label: zh ? "纽约" : "New York", dx: -8, dy: -7 },
  };
  const ROUTES = [
    [CITIES.shanghai, CITIES.rotterdam],
    [CITIES.shenzhen, CITIES.dubai],
    [CITIES.shanghai, CITIES.newyork],
  ];

  const routeMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(ROUTE_COLOR),
    transparent: true,
    opacity: ROUTE_ALPHA,
  });
  const endMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PULSE_COLOR),
    transparent: true,
    opacity: 0.8,
  });
  const endGeo = new THREE.CircleGeometry(1, 16);
  const curves = ROUTES.map(([from, to]) => {
    const mid = new THREE.Vector3((from.lon + to.lon) / 2, Math.max(from.lat, to.lat) + 22, 0);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(from.lon, from.lat, 0),
      mid,
      new THREE.Vector3(to.lon, to.lat, 0)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    scene.add(new THREE.Line(geo, routeMat));
    return curve;
  });

  // City markers and labels
  const SCALE = 6;
  const labelFont = `600 ${13 * SCALE}px system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  for (const city of Object.values(CITIES)) {
    const m = new THREE.Mesh(endGeo, endMat);
    m.position.set(city.lon, city.lat, 1);
    scene.add(m);

    const cv = document.createElement("canvas");
    const g = cv.getContext("2d");
    g.font = labelFont;
    const wpx = Math.ceil(g.measureText(city.label).width) + 4 * SCALE;
    cv.width = wpx;
    cv.height = 18 * SCALE;
    const g2 = cv.getContext("2d");
    g2.font = labelFont;
    g2.textBaseline = "middle";
    g2.fillStyle = LABEL_COLOR;
    g2.fillText(city.label, 2 * SCALE, cv.height / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wUnits = wpx / SCALE / 4.2;
    const hUnits = cv.height / SCALE / 4.2;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(wUnits, hUnits),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    label.position.set(city.lon + city.dx + (city.dx > 0 ? wUnits / 2 : -wUnits / 2), city.lat + city.dy, 3);
    scene.add(label);
  }

  // Pulses along the routes
  const pulseGeo = new THREE.CircleGeometry(1.3, 16);
  const pulses = [];
  curves.forEach((curve, ci) => {
    for (let k = 0; k < 2; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PULSE_COLOR), transparent: true });
      const mesh = new THREE.Mesh(pulseGeo, mat);
      mesh.position.z = 2;
      scene.add(mesh);
      pulses.push({ mesh, mat, curve, t: (ci * 0.23 + k * 0.5) % 1, speed: 0.045 + 0.012 * ci });
    }
  });
  const placePulses = () => {
    pulses.forEach((p) => {
      const pt = p.curve.getPointAt(p.t);
      p.mesh.position.x = pt.x;
      p.mesh.position.y = pt.y;
      const fade = Math.min(p.t / 0.12, (1 - p.t) / 0.12, 1);
      p.mat.opacity = 0.85 * Math.max(fade, 0);
    });
  };

  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.style.aspectRatio = window.innerWidth < 700 ? "1.7" : "2.4";
  mount.appendChild(canvas);

  const resize = () => {
    const w = mount.clientWidth;
    const h = canvas.clientHeight || (w / 2.4);
    renderer.setSize(w, h, false);
    // Fixed latitude window (cuts the far south, keeps all routes); the
    // longitude span follows the canvas aspect, centered between the
    // route endpoints.
    const latSpan = 118;
    const latMid = 16;
    const lonSpan = latSpan * (w / h);
    const lonMid = 25;
    camera.left = lonMid - lonSpan / 2;
    camera.right = lonMid + lonSpan / 2;
    camera.top = latMid + latSpan / 2;
    camera.bottom = latMid - latSpan / 2;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(mount);

  placePulses();
  renderer.render(scene, camera);
  if (reducedMotion) return;

  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(mount);

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      pulses.forEach((p) => {
        p.t = (p.t + p.speed * dt) % 1;
      });
      placePulses();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
