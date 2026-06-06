// ═══════════════════════════════════════════════
// FLIGHT ENGINE  –  3D physics + Three.js render
// ═══════════════════════════════════════════════

const FlightEngine = (() => {
  let scene, camera, renderer;
  let rocketMesh, flameMesh, exhaustParticles = [];
  let terrainMesh, skyMesh, atmosphereMesh;
  let stars = [];
  let mapVisible = false;

  const G = 6.674e-11;

  // Rocket state (SI units)
  const R = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    ax: 0, ay: 0, az: 0,
    angle: 0,   // rotation around Z (pitch)
    roll: 0,
    angVel: 0,
    mass: 0,
    dryMass: 0,
    stages: [],
    currentStage: 0,
    engineOn: false,
    sas: false,
    throttle: 1,
    landed: true,
    destroyed: false,
    hasChute: false,
    chuteDeployed: false,
  };

  let planet = null;
  let running = false;
  let rafId = null;
  let lastTime = 0;
  let camMode = 'follow'; // 'follow', 'chase', 'map'

  // Camera
  let camOrbit = { theta: 0, phi: 0.4, dist: 50 };
  let isDragging = false, lastMX = 0, lastMY = 0;

  // ─── INIT ──────────────────────────────────────
  function init(rocketData, planetData) {
    planet = planetData;
    buildRocket(rocketData);

    const canvas = document.getElementById('flightCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1e8);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    setupLights();
    buildStars();
    buildPlanet();
    buildRocketMesh();
    setupInput(canvas);
    setupHUDEvents();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      camera.aspect = canvas.width / canvas.height;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.width, canvas.height);
    });

    updateHUD();
  }

  // ─── ROCKET DATA ───────────────────────────────
  function buildRocket(data) {
    const p = planet || WorldManager.getActivePlanet();
    R.x = 0;
    R.y = p.radius + 5;
    R.z = 0;
    R.vx = 0; R.vy = 0; R.vz = 0;
    R.angle = 0; R.angVel = 0;
    R.landed = true; R.destroyed = false;
    R.engineOn = false; R.chuteDeployed = false;
    R.throttle = 1;

    if (!data || data.parts.length === 0) {
      R.mass = 10000; R.dryMass = 2000;
      R.stages = [{ fuel: 5000, fuelMax: 5000, thrust: 845000, isp: 300, engines: 1 }];
      R.hasChute = false;
    } else {
      R.mass = data.totalMass;
      R.dryMass = data.totalMass - data.totalFuel;
      R.hasChute = data.parts.some(p => p.def.type === 'chute');

      // Build stages from separator positions
      const seps = data.parts.filter(p => p.def.type === 'sep').sort((a,b) => a.gridY - b.gridY);
      const stageNums = [...new Set(data.parts.map(p => p.stageNum))].sort((a,b)=>a-b);

      R.stages = stageNums.map(sn => {
        const sp = data.parts.filter(p => p.stageNum === sn);
        const fuel = sp.filter(p=>p.def.type==='tank'||p.def.type==='srb').reduce((s,p)=>s+p.def.fuel,0);
        const thrust = sp.filter(p=>p.def.type==='engine'||p.def.type==='srb').reduce((s,p)=>s+p.def.thrust,0);
        const isp = sp.filter(p=>p.def.type==='engine'||p.def.type==='srb').length > 0
          ? sp.filter(p=>p.def.type==='engine'||p.def.type==='srb').reduce((s,p)=>s+p.def.isp,0)
            / sp.filter(p=>p.def.type==='engine'||p.def.type==='srb').length
          : 300;
        return { fuel, fuelMax: fuel, thrust: thrust * 1000, isp, engines: sp.filter(p=>p.def.type==='engine').length };
      });
      if (R.stages.length === 0 || R.stages.every(s=>s.thrust===0)) {
        R.stages = [{ fuel: data.totalFuel, fuelMax: data.totalFuel, thrust: data.totalThrust * 1000, isp: 300, engines: 1 }];
      }
    }
    R.currentStage = 0;
  }

  // ─── SCENE SETUP ───────────────────────────────
  function setupLights() {
    scene.add(new THREE.AmbientLight(0x334466, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(1e7, 1e7, 0);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x334488, 0x221100, 0.4));
  }

  function buildStars() {
    const geo = new THREE.BufferGeometry();
    const verts = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5e7 + Math.random() * 5e7;
      verts.push(r*Math.sin(phi)*Math.cos(theta), r*Math.sin(phi)*Math.sin(theta), r*Math.cos(phi));
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 20000, sizeAttenuation: true });
    const starField = new THREE.Points(geo, mat);
    scene.add(starField);
  }

  function buildPlanet() {
    // Remove old
    if (terrainMesh) scene.remove(terrainMesh);
    if (skyMesh) scene.remove(skyMesh);
    if (atmosphereMesh) scene.remove(atmosphereMesh);

    const pColor = parseInt(planet.color.replace('#',''), 16);
    const planetGeo = new THREE.SphereGeometry(planet.radius, 64, 32);
    const planetMat = new THREE.MeshPhongMaterial({
      color: pColor, shininess: 8,
      specular: 0x112233,
    });
    // Add some terrain noise via vertex displacement (subtle)
    const posArr = planetGeo.attributes.position.array;
    for (let i = 0; i < posArr.length; i += 3) {
      const noise = 1 + (Math.random() - 0.5) * 0.002;
      posArr[i] *= noise; posArr[i+1] *= noise; posArr[i+2] *= noise;
    }
    planetGeo.computeVertexNormals();
    terrainMesh = new THREE.Mesh(planetGeo, planetMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // Atmosphere
    if (planet.atmoH > 0) {
      const atmoGeo = new THREE.SphereGeometry(planet.radius + planet.atmoH, 32, 16);
      const atmoMat = new THREE.MeshPhongMaterial({
        color: planet.skyColor ? parseInt(planet.skyColor.replace('#',''), 16) : 0x1a3a6b,
        transparent: true, opacity: 0.12, side: THREE.FrontSide,
      });
      atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
      scene.add(atmosphereMesh);
    }

    // Ocean for Earth
    if (planet.hasOcean) {
      const oceanGeo = new THREE.SphereGeometry(planet.radius * 0.999, 32, 16);
      const oceanMat = new THREE.MeshPhongMaterial({
        color: 0x1a4a8a, transparent: true, opacity: 0.85, shininess: 100, specular: 0x4488bb,
      });
      scene.add(new THREE.Mesh(oceanGeo, oceanMat));
    }
  }

  function buildRocketMesh() {
    if (rocketMesh) scene.remove(rocketMesh);
    rocketMesh = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 12);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0xccddee, shininess: 80 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    rocketMesh.add(body);

    // Nose
    const noseGeo = new THREE.ConeGeometry(0.8, 3, 12);
    const noseMat = new THREE.MeshPhongMaterial({ color: 0xddeeff });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.y = 4.5;
    rocketMesh.add(nose);

    // Engine bell
    const bellPoints = [];
    for (let i = 0; i <= 6; i++) {
      bellPoints.push(new THREE.Vector2(0.3 + i * 0.08, -i * 0.2));
    }
    const bellGeo = new THREE.LatheGeometry(bellPoints, 12);
    const bellMat = new THREE.MeshPhongMaterial({ color: 0x556677 });
    const bell = new THREE.Mesh(bellGeo, bellMat);
    bell.position.y = -3.2;
    rocketMesh.add(bell);

    // Fins
    [-1,1].forEach(side => {
      const finGeo = new THREE.BoxGeometry(0.08, 2, 1.5);
      const finMat = new THREE.MeshPhongMaterial({ color: 0xaabbcc });
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.set(side * 1.2, -2.5, 0);
      rocketMesh.add(fin);
    });

    // Flame group
    flameMesh = new THREE.Group();
    flameMesh.visible = false;
    rocketMesh.add(flameMesh);

    // Flame cone
    const flameGeo = new THREE.ConeGeometry(0.35, 3, 8);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.9,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = -1.5;
    flame.rotation.x = Math.PI;
    flameMesh.add(flame);

    // Inner flame
    const innerGeo = new THREE.ConeGeometry(0.15, 2, 8);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.95 });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = -1.2;
    inner.rotation.x = Math.PI;
    flameMesh.add(inner);

    // Light from flame
    const flameLight = new THREE.PointLight(0xff6600, 3, 20);
    flameLight.name = 'flameLight';
    flameMesh.add(flameLight);

    scene.add(rocketMesh);
  }

  // ─── INPUT ─────────────────────────────────────
  const keys = {};
  function setupInput(canvas) {
    document.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); nextStage(); }
      if (e.code === 'KeyE') toggleEngine();
      if (e.code === 'KeyM') toggleMap();
      if (e.code === 'KeyT') toggleSAS();
      if (e.code === 'KeyV') {
        const modes = ['follow','chase'];
        camMode = modes[(modes.indexOf(camMode)+1)%modes.length];
      }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });

    canvas.addEventListener('mousedown', e => {
      isDragging = true; lastMX = e.clientX; lastMY = e.clientY;
    });
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      camOrbit.theta -= (e.clientX - lastMX) * 0.005;
      camOrbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, camOrbit.phi + (e.clientY - lastMY) * 0.005));
      lastMX = e.clientX; lastMY = e.clientY;
    });
    canvas.addEventListener('wheel', e => {
      camOrbit.dist = Math.max(5, Math.min(5e6, camOrbit.dist * (1 + e.deltaY * 0.001)));
    });

    // Throttle slider
    const slider = document.getElementById('throttleSlider');
    if (slider) {
      slider.addEventListener('input', () => {
        R.throttle = parseFloat(slider.value);
        const pctEl = document.getElementById('throttleVal');
        if (pctEl) pctEl.textContent = Math.round(R.throttle * 100) + '%';
      });
    }
  }

  function setupHUDEvents() {
    // Throttle init
    const slider = document.getElementById('throttleSlider');
    if (slider) { slider.value = 1; }
  }

  // ─── PHYSICS ───────────────────────────────────
  function update(dt) {
    if (R.destroyed) return;

    dt = Math.min(dt, 0.05); // cap at 50ms

    const dist = Math.sqrt(R.x*R.x + R.y*R.y + R.z*R.z);
    const alt = dist - planet.radius;

    // Direction from planet center (up)
    const nx = R.x/dist, ny = R.y/dist, nz = R.z/dist;

    // Gravity
    const gMag = (G * planet.mass) / (dist * dist);
    R.ax = -gMag * nx;
    R.ay = -gMag * ny;
    R.az = -gMag * nz;

    // Engine
    if (R.engineOn) {
      const stage = R.stages[R.currentStage];
      if (stage && stage.fuel > 0 && stage.thrust > 0) {
        const thrustN = stage.thrust * R.throttle;
        // Rocket points up-ish, apply thrust in rocket direction
        const sinA = Math.sin(R.angle), cosA = Math.cos(R.angle);
        // In 2D-ish physics: angle is rotation from surface normal
        const tx = sinA; const ty = cosA;
        // Rotate into world space: up direction is nx,ny
        // Simplified: thrust in y=up world direction modified by angle
        const worldTx = tx * (1 - ny) + nx * cosA;
        const worldTy = ty * ny + ny * cosA + nx * sinA;
        R.ax += (thrustN / R.mass) * (-nz * sinA);
        R.ay += (thrustN / R.mass) * (cosA);
        R.az += (thrustN / R.mass) * (nx * sinA);

        // Simpler & more stable: thrust along rocket axis (angle from zenith)
        R.ax = -gMag * nx + (thrustN / R.mass) * Math.sin(R.angle) * (-nz === 0 ? 1 : -nz);
        R.ay = -gMag * ny + (thrustN / R.mass) * Math.cos(R.angle);
        R.az = -gMag * nz + 0;

        // Fuel burn
        const mdot = thrustN / (stage.isp * 9.81);
        stage.fuel = Math.max(0, stage.fuel - mdot * dt);
        R.mass = Math.max(R.dryMass * 0.5, R.mass - mdot * dt);
        if (stage.fuel <= 0) {
          R.engineOn = false;
          notify('Bahan bakar habis – Stage ' + (R.currentStage + 1));
        }
      } else {
        R.engineOn = false;
      }
    }

    // Parachute drag
    if (R.chuteDeployed && alt < planet.atmoH) {
      const vel = Math.sqrt(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);
      if (vel > 0.1) {
        const chuteDrag = 200 * vel / R.mass;
        R.vx -= chuteDrag * (R.vx/vel) * dt;
        R.vy -= chuteDrag * (R.vy/vel) * dt;
        R.vz -= chuteDrag * (R.vz/vel) * dt;
      }
    }

    // Atmosphere drag
    if (alt < planet.atmoH && alt > 0 && !R.chuteDeployed) {
      const atmoFrac = Math.max(0, 1 - alt / planet.atmoH);
      const rho = atmoFrac * atmoFrac * 1.225;
      const vel = Math.sqrt(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);
      if (vel > 0.1) {
        const drag = (0.5 * rho * 0.4 * 3 * vel * vel) / R.mass;
        R.ax -= drag * (R.vx/vel);
        R.ay -= drag * (R.vy/vel);
        R.az -= drag * (R.vz/vel);
      }
    }

    // Controls
    if (keys['ArrowLeft'] || keys['KeyA']) R.angVel -= 1.5 * dt;
    if (keys['ArrowRight'] || keys['KeyD']) R.angVel += 1.5 * dt;
    if (keys['ArrowUp'] || keys['KeyW']) {
      R.throttle = Math.min(1, R.throttle + dt);
      const sl = document.getElementById('throttleSlider');
      if (sl) { sl.value = R.throttle; document.getElementById('throttleVal').textContent = Math.round(R.throttle*100)+'%'; }
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      R.throttle = Math.max(0, R.throttle - dt);
      const sl = document.getElementById('throttleSlider');
      if (sl) { sl.value = R.throttle; document.getElementById('throttleVal').textContent = Math.round(R.throttle*100)+'%'; }
    }

    // SAS
    if (R.sas) R.angVel *= 0.88;
    R.angVel *= 0.97;
    R.angle += R.angVel * dt;

    // Integrate
    R.vx += R.ax * dt;
    R.vy += R.ay * dt;
    R.vz += R.az * dt;

    if (!R.landed) {
      R.x += R.vx * dt;
      R.y += R.vy * dt;
      R.z += R.vz * dt;
    }

    // Ground check
    const newDist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    const velMag = Math.sqrt(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);

    if (newDist <= planet.radius + 3) {
      if (velMag > 15 && !R.chuteDeployed) {
        R.destroyed = true;
        R.engineOn = false;
        notify('💥 Roket hancur! Kecepatan benturan: ' + velMag.toFixed(0) + ' m/s');
      } else {
        R.vx = 0; R.vy = 0; R.vz = 0; R.angVel = 0;
        const s = planet.radius / newDist;
        R.x *= s; R.y *= s; R.z *= s;
        R.landed = true;
        notify('✅ Mendarat! v=' + velMag.toFixed(1) + ' m/s');
      }
    } else {
      R.landed = false;
    }
  }

  // ─── DRAW ──────────────────────────────────────
  function draw() {
    const dist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    const alt = dist - planet.radius;

    // Sky color transition
    if (alt < planet.atmoH && planet.skyColor) {
      const frac = Math.max(0, 1 - alt / planet.atmoH);
      const sc = parseInt(planet.skyColor.replace('#',''), 16);
      const r = ((sc>>16)&0xff)*frac/255;
      const g = ((sc>>8)&0xff)*frac/255;
      const b = (sc&0xff)*frac/255;
      scene.background = new THREE.Color(r, g, b);
    } else {
      scene.background = new THREE.Color(0x000005);
    }

    // Rocket mesh position
    rocketMesh.position.set(R.x, R.y, R.z);

    // Rocket orientation: align with planet surface + angle
    const up = new THREE.Vector3(R.x, R.y, R.z).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(worldUp, up);
    rocketMesh.setRotationFromQuaternion(quaternion);
    rocketMesh.rotateZ(R.angle);

    // Flame
    if (R.engineOn && !R.destroyed) {
      const stage = R.stages[R.currentStage];
      flameMesh.visible = stage && stage.fuel > 0;
      if (flameMesh.visible) {
        flameMesh.scale.y = 0.8 + R.throttle * 0.6 + (Math.random() - 0.5) * 0.2;
        flameMesh.scale.x = flameMesh.scale.z = 0.8 + R.throttle * 0.4;
        const fl = flameMesh.getObjectByName('flameLight');
        if (fl) fl.intensity = 2 + R.throttle * 3 + Math.random();
      }
    } else {
      flameMesh.visible = false;
    }

    // Camera
    updateCam(dist, alt, up);

    renderer.render(scene, camera);
  }

  function updateCam(dist, alt, up) {
    if (camMode === 'follow') {
      // Camera orbits around rocket
      const rPos = new THREE.Vector3(R.x, R.y, R.z);
      const offset = new THREE.Vector3(
        camOrbit.dist * Math.sin(camOrbit.phi) * Math.sin(camOrbit.theta),
        camOrbit.dist * Math.cos(camOrbit.phi),
        camOrbit.dist * Math.sin(camOrbit.phi) * Math.cos(camOrbit.theta)
      );
      // Rotate offset to be relative to planet up
      const right = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0,0,1)).normalize();
      const fwd = new THREE.Vector3().crossVectors(right, up);
      const worldOffset = new THREE.Vector3()
        .addScaledVector(right, offset.x)
        .addScaledVector(up, offset.y)
        .addScaledVector(fwd, offset.z);
      camera.position.copy(rPos).add(worldOffset);
      camera.lookAt(rPos.x, rPos.y, rPos.z);
    } else {
      // Chase cam (behind rocket)
      const rPos = new THREE.Vector3(R.x, R.y, R.z);
      const behind = up.clone().negate().multiplyScalar(camOrbit.dist * 0.3)
        .add(up.clone().multiplyScalar(-camOrbit.dist * 0.1));
      camera.position.copy(rPos).add(behind).addScaledVector(up, camOrbit.dist * 0.15);
      camera.lookAt(rPos);
    }
  }

  // ─── MAP ───────────────────────────────────────
  function toggleMap() {
    mapVisible = !mapVisible;
    const overlay = document.getElementById('mapOverlay');
    if (overlay) overlay.classList.toggle('open', mapVisible);
    if (mapVisible) drawMap();
  }

  function drawMap() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;

    ctx.fillStyle = '#020610';
    ctx.fillRect(0,0,W,H);

    // Grid
    ctx.strokeStyle = 'rgba(30,50,90,.4)'; ctx.lineWidth = 1;
    for (let i=0;i<=10;i++) {
      ctx.beginPath(); ctx.moveTo(i*W/10,0); ctx.lineTo(i*W/10,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*H/10); ctx.lineTo(W,i*H/10); ctx.stroke();
    }

    const mapScale = (W * 0.4) / planet.radius;

    // Atmo
    if (planet.atmoH > 0) {
      const ar = (planet.radius + planet.atmoH) * mapScale;
      const ag = ctx.createRadialGradient(cx,cy,planet.radius*mapScale,cx,cy,ar);
      ag.addColorStop(0, 'rgba(60,120,220,.15)');
      ag.addColorStop(1, 'rgba(60,120,220,0)');
      ctx.beginPath(); ctx.arc(cx,cy,ar,0,Math.PI*2);
      ctx.fillStyle = ag; ctx.fill();
    }

    // Planet
    const pr = planet.radius * mapScale;
    const pg = ctx.createRadialGradient(cx-pr*.15,cy-pr*.15,0,cx,cy,pr);
    pg.addColorStop(0, '#' + planet.color.replace('#',''));
    pg.addColorStop(1, '#111');
    ctx.beginPath(); ctx.arc(cx,cy,pr,0,Math.PI*2);
    ctx.fillStyle = pg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth=1; ctx.stroke();

    // Planet name
    ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='11px Inter'; ctx.textAlign='center';
    ctx.fillText(planet.name.toUpperCase(), cx, cy+4);

    // Rocket
    const dist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    const rAngle = Math.atan2(R.x, R.y);
    const rrx = cx + dist * mapScale * Math.sin(rAngle);
    const rry = cy - dist * mapScale * Math.cos(rAngle);

    ctx.save(); ctx.translate(rrx, rry); ctx.rotate(R.angle);
    ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(4,5); ctx.lineTo(-4,5); ctx.closePath();
    ctx.fillStyle = '#00d4ff'; ctx.fill();
    ctx.restore();

    // Orbit prediction
    drawOrbit(ctx, cx, cy, mapScale);

    // Info
    const alt = dist - planet.radius;
    ctx.fillStyle='#4a6a9a'; ctx.font='10px Inter'; ctx.textAlign='left';
    ctx.fillText('ALT: ' + fmtDist(alt), 10, H-30);
    ctx.fillText('VEL: ' + Math.sqrt(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz).toFixed(0) + ' m/s', 10, H-16);
  }

  function drawOrbit(ctx, cx, cy, mapScale) {
    const mu = G * planet.mass;
    const dist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    const vel2 = R.vx*R.vx+R.vy*R.vy+R.vz*R.vz;
    const E = 0.5*vel2 - mu/dist;
    if (E >= 0) return; // hyperbolic
    const a = -mu/(2*E);
    const hx = R.y*R.vz-R.z*R.vy, hy = R.z*R.vx-R.x*R.vz, hz = R.x*R.vy-R.y*R.vx;
    const h2 = hx*hx+hy*hy+hz*hz;
    const ecc = Math.sqrt(Math.max(0, 1+2*E*h2/(mu*mu)));
    if (ecc >= 1) return;
    const b = a * Math.sqrt(1-ecc*ecc);
    const theta = Math.atan2(R.x, R.y);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(theta);
    ctx.beginPath();
    ctx.ellipse(0, 0, a*mapScale, b*mapScale, 0, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(0,180,255,.45)'; ctx.lineWidth=1;
    ctx.setLineDash([4,5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  // ─── HUD ───────────────────────────────────────
  function updateHUD() {
    const dist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    const alt = dist - planet.radius;
    const vel = Math.sqrt(R.vx*R.vx+R.vy*R.vy+R.vz*R.vz);
    const mu = G * planet.mass;

    const nx=R.x/dist, ny=R.y/dist, nz=R.z/dist;
    const vert = R.vx*nx+R.vy*ny+R.vz*nz;
    const horiz = Math.sqrt(Math.max(0,vel*vel-vert*vert));

    setText('hudAlt',   fmtDist(Math.max(0,alt)));
    setText('hudVel',   vel.toFixed(1)+' m/s');
    setText('hudVert',  (vert>=0?'+':'')+vert.toFixed(1)+' m/s');
    setText('hudHoriz', horiz.toFixed(1)+' m/s');
    setText('hudMass',  (R.mass/1000).toFixed(2)+' t');
    setText('hudStage', 'STAGE '+(R.currentStage+1));

    const stage = R.stages[R.currentStage];
    const thrN = R.engineOn && stage ? stage.thrust * R.throttle : 0;
    const gForce = thrN / (R.mass * 9.81);
    setText('hudG', gForce.toFixed(2)+' G');

    const vertEl = document.getElementById('hudVert');
    if (vertEl) vertEl.className = 'tele-val'+(vert<-30?' crit':vert<-10?' warn':'');

    // Orbital
    const E = 0.5*vel*vel - mu/dist;
    if (E < 0) {
      const a = -mu/(2*E);
      const hx=R.y*R.vz-R.z*R.vy, hy=R.z*R.vx-R.x*R.vz, hz=R.x*R.vy-R.y*R.vx;
      const h2=hx*hx+hy*hy+hz*hz;
      const ecc=Math.sqrt(Math.max(0,1+2*E*h2/(mu*mu)));
      if (ecc < 1) {
        const ra=a*(1+ecc), rp=a*(1-ecc);
        setText('hudApo',  fmtDist(ra-planet.radius));
        setText('hudPeri', fmtDist(Math.max(-planet.radius,rp-planet.radius)));
        const orEl = document.getElementById('hudOrbit');
        const inOrbit = (rp-planet.radius) > (planet.atmoH||0);
        if (orEl) { orEl.textContent=inOrbit?'YA':'TIDAK'; orEl.style.color=inOrbit?'#4caf7d':'#e05050'; }
      }
    } else {
      setText('hudApo','∞'); setText('hudPeri','-');
    }

    // Fuel bar(s)
    updateFuelBars();
  }

  function updateFuelBars() {
    const cont = document.getElementById('fuelBarsHUD');
    if (!cont) return;
    cont.innerHTML = '';
    R.stages.forEach((s,i) => {
      if (s.fuelMax <= 0) return;
      const pct = s.fuel/s.fuelMax*100;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:.65rem;';
      wrap.innerHTML = `<span style="color:var(--dim);width:40px;text-align:right">S${i+1}</span>
        <div style="width:90px;height:8px;background:var(--bg-panel);border-radius:2px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${i===R.currentStage?'#3a6fcc':'#334466'};transition:.1s"></div>
        </div>
        <span style="color:var(--dim)">${Math.round(pct)}%</span>`;
      cont.appendChild(wrap);
    });
  }

  // ─── CONTROLS ──────────────────────────────────
  function toggleEngine() {
    R.engineOn = !R.engineOn;
    const btn = document.getElementById('btnEngine');
    if (btn) { btn.textContent = R.engineOn ? '🔥 Matikan' : '🔥 Nyalakan'; btn.classList.toggle('on', R.engineOn); }
    notify(R.engineOn ? 'Mesin dinyalakan' : 'Mesin dimatikan');
  }

  function toggleSAS() {
    R.sas = !R.sas;
    const btn = document.getElementById('btnSAS');
    if (btn) { btn.textContent = R.sas ? '🔄 SAS ON' : '🔄 SAS OFF'; btn.classList.toggle('on', R.sas); }
    notify(R.sas ? 'SAS aktif' : 'SAS nonaktif');
  }

  function nextStage() {
    if (R.currentStage < R.stages.length-1) {
      R.currentStage++;
      notify('Stage '+(R.currentStage+1)+' dipisahkan');
      const sEl = document.getElementById('hudStageNum');
      if (sEl) sEl.textContent = R.currentStage+1;
    } else {
      notify('Tidak ada stage lagi');
    }
  }

  function deployChute() {
    if (!R.hasChute) { notify('Tidak ada parasut!'); return; }
    const dist = Math.sqrt(R.x*R.x+R.y*R.y+R.z*R.z);
    if (dist - planet.radius > (planet.atmoH||0)) { notify('Terlalu tinggi untuk parasut!'); return; }
    R.chuteDeployed = true; R.engineOn = false;
    notify('🪂 Parasut dibuka!');
  }

  // ─── LOOP ──────────────────────────────────────
  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    updateHUD();
    if (mapVisible) drawMap();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  // ─── UTILS ─────────────────────────────────────
  function fmtDist(v) {
    if (v < 10000) return v.toFixed(0)+' m';
    if (v < 1e6) return (v/1000).toFixed(2)+' km';
    return (v/1e6).toFixed(3)+' Mm';
  }
  function setText(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; }

  return { init, start, stop, toggleEngine, toggleSAS, nextStage, deployChute, toggleMap };
})();
