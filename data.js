// ═══════════════════════════════════════════════
// WORLDS / PLANETS
// ═══════════════════════════════════════════════
const SOLAR_SYSTEMS = {
  standard: {
    name: 'Tata Surya (Standar)',
    planets: [
      { id:'sun',     name:'Matahari', radius:695700000, mass:1.989e30, color:'#FFD700', atmoH:0,      g:274,  distance:0,          icon:'☀️' },
      { id:'mercury', name:'Merkurius',radius:2440000,   mass:3.285e23, color:'#a0a0a0', atmoH:0,      g:3.7,  distance:57.9e9,     icon:'⚫' },
      { id:'venus',   name:'Venus',    radius:6051000,   mass:4.867e24, color:'#e8c060', atmoH:250000, g:8.87, distance:108.2e9,    icon:'🟡', skyColor:'#3a2810' },
      { id:'earth',   name:'Bumi',     radius:6371000,   mass:5.972e24, color:'#2d7a3a', atmoH:100000, g:9.81, distance:149.6e9,    icon:'🌍', skyColor:'#1a3a6b', hasOcean:true },
      { id:'moon',    name:'Bulan',    radius:1737000,   mass:7.342e22, color:'#888',    atmoH:0,      g:1.62, distance:149.984e9,  icon:'🌕', parentId:'earth' },
      { id:'mars',    name:'Mars',     radius:3390000,   mass:6.39e23,  color:'#c1440e', atmoH:60000,  g:3.72, distance:227.9e9,    icon:'🔴', skyColor:'#3a1a0a' },
      { id:'phobos',  name:'Phobos',   radius:11266,     mass:1.066e16, color:'#777',    atmoH:0,      g:0.0057,distance:227.9094e9,icon:'⚫', parentId:'mars' },
      { id:'jupiter', name:'Jupiter',  radius:71492000,  mass:1.898e27, color:'#c88040', atmoH:500000, g:24.79,distance:778.5e9,   icon:'🟠' },
      { id:'europa',  name:'Europa',   radius:1561000,   mass:4.8e22,   color:'#90c0e0', atmoH:200,    g:1.315,distance:778.921e9, icon:'🔵', parentId:'jupiter' },
    ]
  }
};

// ═══════════════════════════════════════════════
// PARTS LIBRARY
// ═══════════════════════════════════════════════
const PART_CATEGORIES = [
  {
    id: 'nose', label: 'Aero', icon: '▲',
    parts: [
      { id:'nose_basic', name:'Hidung Dasar',   w:1, h:1.5, mass:100,  thrust:0,   fuel:0,    type:'nose',  color:'#ccd', shape:'cone',   isp:0   },
      { id:'nose_6',     name:'Hidung 6 Lebar', w:1.5,h:2,  mass:180,  thrust:0,   fuel:0,    type:'nose',  color:'#dde', shape:'cone',   isp:0   },
      { id:'nose_8',     name:'Hidung 8 Lebar', w:2,  h:2.5,mass:260,  thrust:0,   fuel:0,    type:'nose',  color:'#ccd', shape:'cone',   isp:0   },
      { id:'nose_10',    name:'Hidung 10 Lebar',w:2.5,h:3,  mass:350,  thrust:0,   fuel:0,    type:'nose',  color:'#bbc', shape:'cone',   isp:0   },
      { id:'nose_12',    name:'Hidung 12 Lebar',w:3,  h:3.5,mass:450,  thrust:0,   fuel:0,    type:'nose',  color:'#aab', shape:'cone',   isp:0   },
      { id:'fairing_s',  name:'Fairing Kecil',  w:1.5,h:3,  mass:400,  thrust:0,   fuel:0,    type:'fairing',color:'#8aa', shape:'fairing',isp:0  },
      { id:'fairing_m',  name:'Fairing Sedang', w:2,  h:4,  mass:700,  thrust:0,   fuel:0,    type:'fairing',color:'#8aa', shape:'fairing',isp:0  },
    ]
  },
  {
    id: 'tank', label: 'Tangki\nBahan Bakar', icon: '▬',
    parts: [
      { id:'tank_xs',  name:'Tangki XS',    w:1,   h:1,   mass:200,   thrust:0, fuel:800,   type:'tank', color:'#aabbcc', shape:'cylinder', isp:0 },
      { id:'tank_s',   name:'Tangki S',     w:1,   h:2,   mass:500,   thrust:0, fuel:2000,  type:'tank', color:'#aabbcc', shape:'cylinder', isp:0 },
      { id:'tank_m',   name:'Tangki M',     w:1,   h:3,   mass:900,   thrust:0, fuel:5000,  type:'tank', color:'#aabbcc', shape:'cylinder', isp:0 },
      { id:'tank_l',   name:'Tangki L',     w:1,   h:5,   mass:1800,  thrust:0, fuel:12000, type:'tank', color:'#aabbcc', shape:'cylinder', isp:0 },
      { id:'tank_xl',  name:'Tangki XL',    w:1,   h:8,   mass:3500,  thrust:0, fuel:28000, type:'tank', color:'#aabbcc', shape:'cylinder', isp:0 },
      { id:'tank_2_s', name:'Tangki 2x S',  w:2,   h:2,   mass:900,   thrust:0, fuel:4000,  type:'tank', color:'#99aabc', shape:'cylinder', isp:0 },
      { id:'tank_2_m', name:'Tangki 2x M',  w:2,   h:4,   mass:2000,  thrust:0, fuel:11000, type:'tank', color:'#99aabc', shape:'cylinder', isp:0 },
      { id:'tank_2_l', name:'Tangki 2x L',  w:2,   h:7,   mass:4500,  thrust:0, fuel:28000, type:'tank', color:'#99aabc', shape:'cylinder', isp:0 },
    ]
  },
  {
    id: 'engine', label: 'Mesin', icon: '🔥',
    parts: [
      { id:'eng_tiny',   name:'Mesin Mini',     w:0.6,h:0.8, mass:80,   thrust:50,   fuel:0, type:'engine', color:'#778899', shape:'engine', isp:280 },
      { id:'eng_small',  name:'Mesin Kecil',    w:0.8,h:1,   mass:200,  thrust:180,  fuel:0, type:'engine', color:'#667788', shape:'engine', isp:295 },
      { id:'eng_merlin', name:'Merlin',         w:1,  h:1.2, mass:470,  thrust:845,  fuel:0, type:'engine', color:'#556677', shape:'engine', isp:311 },
      { id:'eng_raptor', name:'Raptor',         w:1.2,h:1.4, mass:1500, thrust:2200, fuel:0, type:'engine', color:'#445566', shape:'engine', isp:330 },
      { id:'eng_rl10',   name:'RL-10 Vakum',    w:1,  h:1.5, mass:168,  thrust:110,  fuel:0, type:'engine', color:'#446655', shape:'engine', isp:465 },
      { id:'eng_vac',    name:'Mesin Vakum',    w:1.5,h:2,   mass:600,  thrust:600,  fuel:0, type:'engine', color:'#445566', shape:'engine', isp:420 },
    ]
  },
  {
    id: 'landing', label: 'Pendaratan', icon: '🪂',
    parts: [
      { id:'chute_s',  name:'Parasut Kecil',  w:0.5,h:0.3, mass:80,  thrust:0, fuel:0, type:'chute',    color:'#bb3333', shape:'capsule_small', isp:0 },
      { id:'chute_m',  name:'Parasut Sedang', w:0.7,h:0.4, mass:150, thrust:0, fuel:0, type:'chute',    color:'#cc2222', shape:'capsule_small', isp:0 },
      { id:'leg',      name:'Kaki Pendaratan',w:0.3,h:1.5, mass:200, thrust:0, fuel:0, type:'leg',      color:'#889',    shape:'leg',           isp:0 },
      { id:'leg_l',    name:'Kaki Panjang',   w:0.3,h:2.5, mass:350, thrust:0, fuel:0, type:'leg',      color:'#778',    shape:'leg',           isp:0 },
      { id:'heatshield',name:'Perisai Panas', w:1.5,h:0.3, mass:600, thrust:0, fuel:0, type:'heatshield',color:'#c8a060',shape:'disk',          isp:0 },
    ]
  },
  {
    id: 'command', label: 'Kendali', icon: '🔺',
    parts: [
      { id:'capsule_s',  name:'Kapsul Kecil',   w:0.8,h:1,   mass:800,  thrust:0, fuel:0, type:'capsule', color:'#887766', shape:'capsule',       isp:0 },
      { id:'capsule_m',  name:'Kapsul Sedang',  w:1,  h:1.3, mass:2000, thrust:0, fuel:0, type:'capsule', color:'#998877', shape:'capsule',       isp:0 },
      { id:'probe',      name:'Probe Core',     w:0.5,h:0.5, mass:150,  thrust:0, fuel:0, type:'capsule', color:'#445566', shape:'capsule_small', isp:0 },
      { id:'lander_can', name:'Kabin Lander',   w:1.2,h:1.5, mass:1800, thrust:0, fuel:0, type:'capsule', color:'#667755', shape:'capsule',       isp:0 },
    ]
  },
  {
    id: 'stage', label: 'Tahapan', icon: '➖',
    parts: [
      { id:'sep_s',   name:'Pemisah Kecil', w:1,  h:0.15, mass:50,  thrust:0, fuel:0, type:'sep', color:'#cc9933', shape:'disk', isp:0 },
      { id:'sep_m',   name:'Pemisah Sedang',w:1.5,h:0.15, mass:80,  thrust:0, fuel:0, type:'sep', color:'#cc9933', shape:'disk', isp:0 },
      { id:'adapter', name:'Adapter',       w:1,  h:0.6,  mass:120, thrust:0, fuel:0, type:'adapter',color:'#667788',shape:'frustum', isp:0 },
      { id:'srb_s',   name:'SRB Kecil',     w:0.8,h:4,    mass:3000,thrust:800, fuel:3000, type:'srb', color:'#aa8866', shape:'cylinder', isp:250 },
      { id:'srb_m',   name:'SRB Sedang',    w:1,  h:6,    mass:7000,thrust:2000,fuel:8000, type:'srb', color:'#aa8866', shape:'cylinder', isp:265 },
    ]
  },
  {
    id: 'heatshield', label: 'Perisai\nPanas', icon: '🛡',
    parts: [
      { id:'hs_s', name:'Perisai S', w:1,  h:0.25, mass:400, thrust:0, fuel:0, type:'heatshield', color:'#b8925a', shape:'disk', isp:0 },
      { id:'hs_m', name:'Perisai M', w:1.5,h:0.3,  mass:700, thrust:0, fuel:0, type:'heatshield', color:'#b8925a', shape:'disk', isp:0 },
      { id:'hs_l', name:'Perisai L', w:2,  h:0.35, mass:1100,thrust:0, fuel:0, type:'heatshield', color:'#b8925a', shape:'disk', isp:0 },
    ]
  },
  {
    id: 'structural', label: 'Dudukan', icon: '⬛',
    parts: [
      { id:'pad_s',   name:'Dudukan Kecil', w:1.5,h:0.3, mass:200, thrust:0, fuel:0, type:'structural', color:'#8899aa', shape:'disk',     isp:0 },
      { id:'pad_m',   name:'Dudukan Sedang',w:2,  h:0.4, mass:350, thrust:0, fuel:0, type:'structural', color:'#8899aa', shape:'disk',     isp:0 },
      { id:'strut_s', name:'Strut Kecil',   w:0.2,h:2,   mass:80,  thrust:0, fuel:0, type:'structural', color:'#667788', shape:'cylinder', isp:0 },
      { id:'fin',     name:'Sirip Ekor',    w:0.1,h:1.5, mass:150, thrust:0, fuel:0, type:'structural', color:'#778899', shape:'fin',      isp:0 },
      { id:'fin_l',   name:'Sirip Besar',   w:0.1,h:2.5, mass:280, thrust:0, fuel:0, type:'structural', color:'#778899', shape:'fin',      isp:0 },
      { id:'decoupler',name:'Decoupler',    w:1,  h:0.2, mass:60,  thrust:0, fuel:0, type:'sep',        color:'#cc9933', shape:'disk',     isp:0 },
    ]
  },
];

// ═══════════════════════════════════════════════
// WORLD MANAGER
// ═══════════════════════════════════════════════
const WorldManager = {
  worlds: [],
  currentWorld: null,

  create(name, solarSystem, mode, difficulty) {
    const w = {
      id: Date.now(),
      name,
      solarSystem,
      mode,
      difficulty,
      created: new Date().toISOString(),
      rocket: null,
      launchPlanet: 'earth',
    };
    this.worlds.push(w);
    this.currentWorld = w;
    this.save();
    return w;
  },

  save() {
    try { localStorage.setItem('orbitsfs_worlds', JSON.stringify(this.worlds)); } catch(e){}
  },

  load() {
    try {
      const d = localStorage.getItem('orbitsfs_worlds');
      if(d) this.worlds = JSON.parse(d);
    } catch(e){ this.worlds = []; }
  },

  getActivePlanet() {
    const sys = SOLAR_SYSTEMS[this.currentWorld?.solarSystem || 'standard'];
    const pid = this.currentWorld?.launchPlanet || 'earth';
    return sys.planets.find(p => p.id === pid) || sys.planets[3];
  }
};

WorldManager.load();
