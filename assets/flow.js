// Animated version of the hero integration diagram, rendered with three.js.
// The inline SVG stays in the page as the fallback for reduced motion,
// missing WebGL, or a failed CDN load.
(async () => {
  const card = document.querySelector(".diagram-card");
  const svg = card ? card.querySelector("svg") : null;
  if (!card || !svg) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
  } catch {
    return;
  }

  const W = 440;
  const H = 320;
  const COLORS = {
    ink: "#16212e",
    line: "#dde3ea",
    connector: 0xb9c6d4,
    accent: "#1e4e79",
    accentHex: 0x1e4e79,
    hubText: "#ffffff",
    hubSub: "#bcd2e6",
    nodeBg: "#ffffff",
  };

  const zh = document.documentElement.lang.startsWith("zh");
  const nodes = [
    { x: 18, y: 138, w: 100, h: 44, lines: zh ? ["店铺与平台"] : ["Shops &", "marketplaces"] },
    { x: 175, y: 128, w: 90, h: 64, hub: true, lines: zh ? ["YJ Commerce", "集成层"] : ["YJ Commerce", "integration layer"] },
    { x: 322, y: 38, w: 100, h: 44, lines: ["ERP"] },
    { x: 322, y: 88, w: 100, h: 44, lines: zh ? ["海外仓"] : ["Overseas", "warehouse"] },
    { x: 322, y: 188, w: 100, h: 44, lines: zh ? ["物流承运"] : ["Freight &", "carriers"] },
    { x: 322, y: 238, w: 100, h: 44, lines: zh ? ["数据看板"] : ["Dashboards"] },
  ];
  // Branch start y at the hub edge and bezier control/end points, from the SVG paths.
  const branches = [
    { sy: 150, c1: [290, 150], c2: [290, 60], end: [322, 60] },
    { sy: 155, c1: [292, 155], c2: [292, 110], end: [322, 110] },
    { sy: 165, c1: [292, 165], c2: [292, 210], end: [322, 210] },
    { sy: 170, c1: [290, 170], c2: [290, 260], end: [322, 260] },
  ];

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
  const Y = (y) => H - y;

  // Each node is a plane textured from an offscreen canvas: box, border, label.
  const SCALE = 4;
  const font = (px, weight) =>
    `${weight} ${px * SCALE}px system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;

  const makeNodeTexture = (node) => {
    const cv = document.createElement("canvas");
    cv.width = node.w * SCALE;
    cv.height = node.h * SCALE;
    const g = cv.getContext("2d");
    const r = (node.hub ? 10 : 8) * SCALE;
    g.beginPath();
    g.roundRect(SCALE / 2, SCALE / 2, cv.width - SCALE, cv.height - SCALE, r);
    g.fillStyle = node.hub ? COLORS.accent : COLORS.nodeBg;
    g.fill();
    if (!node.hub) {
      g.strokeStyle = COLORS.line;
      g.lineWidth = SCALE;
      g.stroke();
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    const lines = node.lines;
    if (node.hub) {
      g.fillStyle = COLORS.hubText;
      g.font = font(12, 700);
      g.fillText(lines[0], cv.width / 2, cv.height / 2 - 8 * SCALE);
      g.fillStyle = COLORS.hubSub;
      g.font = font(10.5, 400);
      g.fillText(lines[1], cv.width / 2, cv.height / 2 + 9 * SCALE);
    } else {
      g.fillStyle = COLORS.ink;
      g.font = font(12.5, 600);
      if (lines.length === 1) {
        g.fillText(lines[0], cv.width / 2, cv.height / 2);
      } else {
        g.fillText(lines[0], cv.width / 2, cv.height / 2 - 7 * SCALE);
        g.fillText(lines[1], cv.width / 2, cv.height / 2 + 8 * SCALE);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // Connectors, sampled from the same curves as the SVG.
  const lineMat = new THREE.LineBasicMaterial({ color: COLORS.connector });
  const addLine = (pts) => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, Y(y), 0)));
    scene.add(new THREE.Line(geo, lineMat));
  };
  addLine([[118, 160], [175, 160]]);
  const curves = branches.map((b) => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(265, Y(b.sy), 0),
      new THREE.Vector3(b.c1[0], Y(b.c1[1]), 0),
      new THREE.Vector3(b.c2[0], Y(b.c2[1]), 0),
      new THREE.Vector3(b.end[0], Y(b.end[1]), 0)
    );
    addLine(curve.getPoints(48).map((p) => [p.x, H - p.y]));
    return { curve, sy: b.sy };
  });

  // Nodes above particles, particles above connectors.
  nodes.forEach((n) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(n.w, n.h),
      new THREE.MeshBasicMaterial({ map: makeNodeTexture(n), transparent: true })
    );
    mesh.position.set(n.x + n.w / 2, Y(n.y + n.h / 2), 2);
    scene.add(mesh);
  });

  // Particles travel left node -> hub (visible), through the hub (covered),
  // then out along one of the four branches.
  const particleGeo = new THREE.CircleGeometry(2.4, 20);
  const particles = [];
  const SEG1 = 57; // 118 -> 175
  const SEG2 = 90; // 175 -> 265, under the hub
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.accentHex, transparent: true });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.z = 1;
    scene.add(mesh);
    particles.push({
      mesh,
      mat,
      branch: i % curves.length,
      t: (i / 8 + Math.random() * 0.08) % 1,
      speed: 0.09 + Math.random() * 0.03,
    });
  }

  const placeParticle = (p) => {
    const { curve, sy } = curves[p.branch];
    const curveLen = curve.getLength();
    const total = SEG1 + SEG2 + curveLen;
    const d = p.t * total;
    let x, y;
    if (d < SEG1) {
      x = 118 + d;
      y = Y(160);
    } else if (d < SEG1 + SEG2) {
      const k = (d - SEG1) / SEG2;
      x = 175 + k * 90;
      y = Y(160 + (sy - 160) * k);
    } else {
      const pt = curve.getPointAt(Math.min((d - SEG1 - SEG2) / curveLen, 1));
      x = pt.x;
      y = pt.y;
    }
    p.mesh.position.x = x;
    p.mesh.position.y = y;
    const fade = Math.min(p.t / 0.06, (1 - p.t) / 0.06, 1);
    p.mat.opacity = 0.9 * Math.max(fade, 0);
  };

  // Swap the SVG for the canvas.
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", svg.getAttribute("aria-label") || "");
  svg.style.display = "none";
  card.insertBefore(canvas, card.firstChild);

  const resize = () => {
    const w = card.clientWidth - parseFloat(getComputedStyle(card).paddingLeft) * 2;
    renderer.setSize(Math.max(w, 1), Math.max((w * H) / W, 1), false);
  };
  resize();
  new ResizeObserver(resize).observe(card);

  // Animate only while the diagram is on screen.
  let visible = true;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(card);

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (visible) {
      particles.forEach((p) => {
        p.t += p.speed * dt;
        if (p.t >= 1) {
          p.t = 0;
          p.branch = Math.floor(Math.random() * curves.length);
          p.speed = 0.09 + Math.random() * 0.03;
        }
        placeParticle(p);
      });
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();
