// ═══════════════════════════════════════════════
// BUILDER 3D  –  Three.js based rocket assembler
// ═══════════════════════════════════════════════

const Builder = (() => {
  let scene, camera, renderer, controls;
  let rocketGroup;
  let placedParts = [];       // { def, mesh, gridY, stageNum }
  let selectedPartDef = null;
  let currentCategory = 'nose';
  let ghostMesh = null;
  let currentStage = 1;
  const CELL = 1.0; // 1 unit = 1m scale

  // ─── INIT ──────────────────────────────────────
  function init() {
    const canvas = document.getElementById('buildCanvas3D');
    if (!canvas) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a5280);

    // Grid
    const grid = new THREE.GridHelper(40, 40, 0x4a6090, 0x4a6090);
    grid.position.y = 0;
    scene.add(grid);

    // Launch pad visual
    const padGeo = new THREE.BoxGeometry(4, 0.3, 4);
    const padMat = new THREE.MeshPhongMaterial({ color: 0x445566 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, -0.15, 0);
    scene.add(pad);

    // Camera
    camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 8, 20);
    camera.lookAt(0, 6, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lights
    const ambient = new THREE.AmbientLight(0x8899bb, 0.7);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 15, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const rimLight = new THREE.DirectionalLight(0x3355ff, 0.3);
    rimLight.position.set(-8, 5, -5);
    scene.add(rimLight);

    // Rocket group
    rocketGroup = new THREE.Group();
    scene.add(rocketGroup);

    // OrbitControls (manual simple)
    setupCameraControls(canvas);

    // Resize observer
    new ResizeObserver(() => {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }).observe(canvas);

    render();
    renderUI();
  }

  // ─── CAMERA CONTROLS ───────────────────────────
  let camTheta = 0, camPhi = 0.5, camDist = 20, camTarget = new THREE.Vector3(0,6,0);
  let isDragging = false, lastMX = 0, lastMY = 0;

  function setupCameraControls(canvas) {
    canvas.addEventListener('mousedown', e => { isDragging = true; lastMX = e.clientX; lastMY = e.clientY; });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      camTheta -= dx * 0.008;
      camPhi = Math.max(0.1, Math.min(Math.PI/2 - 0.05, camPhi + dy * 0.006));
      lastMX = e.clientX; lastMY = e.clientY;
      updateCamera();
    });
    canvas.addEventListener('wheel', e => {
      camDist = Math.max(4, Math.min(60, camDist + e.deltaY * 0.02));
      updateCamera();
    });
    canvas.addEventListener('click', onBuildClick);
  }

  function updateCamera() {
    camera.position.x = camTarget.x + camDist * Math.sin(camPhi) * Math.sin(camTheta);
    camera.position.y = camTarget.y + camDist * Math.cos(camPhi);
    camera.position.z = camTarget.z + camDist * Math.sin(camPhi) * Math.cos(camTheta);
    camera.lookAt(camTarget);
  }

  // ─── PART MESH BUILDER ─────────────────────────
  function createPartMesh(def, stageNum) {
    const group = new THREE.Group();
    const color = parseInt(def.color.replace('#',''), 16);
    const mat = new THREE.MeshPhongMaterial({ color, shininess: 60 });
    const r = def.w * 0.5;
    const h = def.h;
    let geo;

    switch (def.shape) {
      case 'cone': {
        geo = new THREE.ConeGeometry(r, h, 16);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
        break;
      }
      case 'cylinder': {
        geo = new THREE.CylinderGeometry(r, r, h, 16);
        // metallic bands
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
        // Ring details
        for (let i = 0; i < Math.floor(h); i++) {
          const rg = new THREE.TorusGeometry(r + 0.01, 0.02, 6, 20);
          const rm = new THREE.Mesh(rg, new THREE.MeshPhongMaterial({ color: 0x556677 }));
          rm.rotation.x = Math.PI / 2;
          rm.position.y = -h/2 + i + 0.5;
          group.add(rm);
        }
        break;
      }
      case 'engine': {
        // Bell shape using lathe
        const points = [];
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          const rx2 = r * 0.3 + r * 0.7 * (t * t);
          const ry = h * 0.5 - h * t;
          points.push(new THREE.Vector2(rx2, ry));
        }
        const latheGeo = new THREE.LatheGeometry(points, 16);
        const lm = new THREE.Mesh(latheGeo, mat);
        lm.castShadow = true;
        group.add(lm);
        // Nozzle opening
        const discGeo = new THREE.CircleGeometry(r, 16);
        const discMat = new THREE.MeshBasicMaterial({ color: 0x223344, side: THREE.DoubleSide });
        const disc = new THREE.Mesh(discGeo, discMat);
        disc.position.y = -h / 2;
        disc.rotation.x = Math.PI / 2;
        group.add(disc);
        break;
      }
      case 'capsule': {
        // Tapered capsule
        const bg = new THREE.CylinderGeometry(r * 0.85, r, h * 0.7, 16);
        const bm = new THREE.Mesh(bg, mat);
        bm.position.y = -h * 0.15;
        bm.castShadow = true;
        group.add(bm);
        const dg = new THREE.SphereGeometry(r * 0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const dm = new THREE.Mesh(dg, mat);
        dm.position.y = h * 0.2;
        group.add(dm);
        // Window
        const wg = new THREE.CircleGeometry(r * 0.2, 12);
        const wm = new THREE.Mesh(wg, new THREE.MeshPhongMaterial({ color: 0x224466, emissive: 0x112233 }));
        wm.position.set(r * 0.75, h * 0.05, 0);
        wm.rotation.y = Math.PI / 2;
        group.add(wm);
        break;
      }
      case 'capsule_small': {
        const sg = new THREE.SphereGeometry(r, 12, 8);
        const sm = new THREE.Mesh(sg, mat);
        sm.scale.y = h / (r * 2);
        sm.castShadow = true;
        group.add(sm);
        break;
      }
      case 'disk': {
        geo = new THREE.CylinderGeometry(r, r, h, 24);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
        break;
      }
      case 'frustum': {
        geo = new THREE.CylinderGeometry(r * 0.6, r, h, 16);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
        break;
      }
      case 'fairing': {
        const pg = new THREE.ConeGeometry(r, h * 0.6, 16);
        const pm = new THREE.Mesh(pg, mat);
        pm.position.y = h * 0.2;
        pm.castShadow = true;
        group.add(pm);
        const cg = new THREE.CylinderGeometry(r, r, h * 0.4, 16);
        const cm = new THREE.Mesh(cg, mat);
        cm.position.y = -h * 0.3;
        group.add(cm);
        break;
      }
      case 'fin': {
        const fg = new THREE.BoxGeometry(def.w * 3, h, 0.05);
        const fm = new THREE.Mesh(fg, mat);
        fm.position.x = def.w;
        fm.castShadow = true;
        group.add(fm);
        break;
      }
      case 'leg': {
        const lg = new THREE.CylinderGeometry(0.05, 0.08, h, 8);
        const lm = new THREE.Mesh(lg, mat);
        lm.rotation.z = Math.PI / 6;
        lm.position.x = h * 0.3;
        lm.castShadow = true;
        group.add(lm);
        // Foot
        const fg = new THREE.SphereGeometry(0.12, 8, 6);
        const fm = new THREE.Mesh(fg, mat);
        fm.position.set(h * 0.55, -h * 0.5, 0);
        group.add(fm);
        break;
      }
      default: {
        geo = new THREE.BoxGeometry(r * 2, h, r * 2);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
      }
    }

    // Stage color band
    const stageColors = [0x00d4ff, 0xff6b00, 0x00ff88, 0xff3399, 0xffd700];
    const sc = stageColors[(stageNum - 1) % stageColors.length];
    const bandGeo = new THREE.TorusGeometry(r + 0.03, 0.03, 6, 20);
    const bandMat = new THREE.MeshBasicMaterial({ color: sc, transparent: true, opacity: 0.7 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = h / 2 - 0.1;
    group.add(band);

    return group;
  }

  // ─── PLACE PART ────────────────────────────────
  function placePart(def) {
    if (!def) return;
    const gridY = getNextY(def);
    const mesh = createPartMesh(def, currentStage);
    mesh.position.set(0, gridY + def.h / 2, 0);
    rocketGroup.add(mesh);
    placedParts.push({ def: { ...def }, mesh, gridY, stageNum: currentStage, fuel: def.fuel });
    // Animate
    mesh.scale.set(0.01, 0.01, 0.01);
    animateScale(mesh, 1, 0.12);
    // Pan camera to part
    camTarget.set(0, gridY + def.h * 0.5 + 2, 0);
    updateCamera();
    updateStats();
    highlightLast();
  }

  function animateScale(obj, target, dur) {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / (dur * 1000));
      const s = target * t;
      obj.scale.set(s, s, s);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function getNextY(def) {
    if (placedParts.length === 0) return 0;
    const top = Math.max(...placedParts.map(p => p.gridY + p.def.h));
    return top;
  }

  function highlightLast() {
    // Brief white outline on last placed
  }

  // ─── UNDO ──────────────────────────────────────
  function undo() {
    if (placedParts.length === 0) return;
    const last = placedParts.pop();
    rocketGroup.remove(last.mesh);
    last.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    updateStats();
  }

  // ─── CLEAR ─────────────────────────────────────
  function clear() {
    placedParts.forEach(p => {
      rocketGroup.remove(p.mesh);
      p.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    });
    placedParts = [];
    updateStats();
  }

  // ─── CLICK ON CANVAS ───────────────────────────
  function onBuildClick(e) {
    // If a part is selected, place it
    if (selectedPartDef) {
      placePart(selectedPartDef);
    }
  }

  // ─── STATS ─────────────────────────────────────
  function getStats() {
    const mass = placedParts.reduce((s, p) => s + p.def.mass, 0);
    const thrust = placedParts.filter(p => p.def.type === 'engine' || p.def.type === 'srb')
      .reduce((s, p) => s + p.def.thrust, 0);
    const fuel = placedParts.filter(p => p.def.type === 'tank' || p.def.type === 'srb')
      .reduce((s, p) => s + p.def.fuel, 0);
    const planet = WorldManager.getActivePlanet();
    const twr = mass > 0 ? (thrust * 1000) / (mass * planet.g) : 0;
    return { mass, thrust, fuel, twr };
  }

  function updateStats() {
    const s = getStats();
    const mEl = document.getElementById('bldMass');
    const tEl = document.getElementById('bldThrust');
    const rEl = document.getElementById('bldTWR');
    if (mEl) mEl.textContent = (s.mass / 1000).toFixed(2) + ' t';
    if (tEl) tEl.textContent = s.thrust.toFixed(0) + ' t';
    if (rEl) {
      rEl.textContent = s.twr.toFixed(2);
      rEl.style.color = s.twr >= 1.2 ? '#4caf7d' : s.twr >= 1 ? '#f5c842' : '#e05050';
    }
  }

  // ─── UI RENDER ─────────────────────────────────
  function renderUI() {
    renderSidebar();
    renderPicker();
  }

  function renderSidebar() {
    const sb = document.getElementById('builderSidebar');
    if (!sb) return;
    sb.innerHTML = '';
    PART_CATEGORIES.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'sidebar-item' + (cat.id === currentCategory ? ' active' : '');
      item.innerHTML = `<span class="sidebar-item-icon">${cat.icon}</span>
        <span class="sidebar-item-label">${cat.label}</span>`;
      item.onclick = () => { currentCategory = cat.id; renderUI(); };
      sb.appendChild(item);
    });
  }

  function renderPicker() {
    const cat = PART_CATEGORIES.find(c => c.id === currentCategory);
    if (!cat) return;
    const title = document.getElementById('pickerTitle');
    if (title) title.textContent = cat.label.replace('\n', ' ').toUpperCase();
    const list = document.getElementById('pickerList');
    if (!list) return;
    list.innerHTML = '';
    cat.parts.forEach(part => {
      const item = document.createElement('div');
      item.className = 'picker-item' + (selectedPartDef?.id === part.id ? ' selected' : '');
      const stat = [
        part.mass + ' kg',
        part.thrust ? part.thrust + ' kN' : '',
        part.fuel ? part.fuel + ' L' : ''
      ].filter(Boolean).join(' · ');
      item.innerHTML = `<div class="picker-item-icon">${getCatIcon(part.type)}</div>
        <div class="picker-item-info">
          <div class="picker-item-name">${part.name}</div>
          <div class="picker-item-stat">${stat}</div>
        </div>`;
      item.onclick = () => {
        selectedPartDef = part;
        renderPicker();
        // Place immediately on click
        placePart(part);
      };
      list.appendChild(item);
    });
  }

  function getCatIcon(type) {
    const icons = { nose:'▲', tank:'▬', engine:'🔥', capsule:'🔺', sep:'➖',
      srb:'🚀', chute:'🪂', leg:'/', heatshield:'🛡', structural:'⬛',
      adapter:'⬇', fairing:'⬆', fin:'◀' };
    return icons[type] || '●';
  }

  // ─── STAGE BUTTONS ─────────────────────────────
  function setStage(n) {
    currentStage = n;
    document.querySelectorAll('.stage-btn-b').forEach((b, i) => {
      b.classList.toggle('active', i + 1 === n);
    });
  }

  // ─── RENDER LOOP ───────────────────────────────
  function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
  }

  // ─── GET ROCKET DATA FOR FLIGHT ─────────────────
  function getRocketData() {
    return {
      parts: placedParts.map(p => ({ ...p, def: { ...p.def } })),
      totalMass: placedParts.reduce((s,p)=>s+p.def.mass,0),
      totalThrust: placedParts.filter(p=>p.def.type==='engine'||p.def.type==='srb').reduce((s,p)=>s+p.def.thrust,0),
      totalFuel: placedParts.filter(p=>p.def.type==='tank'||p.def.type==='srb').reduce((s,p)=>s+p.def.fuel,0),
      hasEngine: placedParts.some(p=>p.def.type==='engine'||p.def.type==='srb'),
      hasCapsule: placedParts.some(p=>p.def.type==='capsule'),
    };
  }

  return { init, undo, clear, getRocketData, setStage, renderUI };
})();
