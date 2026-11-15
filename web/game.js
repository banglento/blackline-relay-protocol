import * as THREE from './vendor/three.module.js';

const canvas = document.querySelector('#game-canvas');
const boot = document.querySelector('#boot-screen');
const hud = document.querySelector('#hud');
const pause = document.querySelector('#pause-screen');
const end = document.querySelector('#end-screen');
const state = { running: false, paused: false, ended: false, health: 100, ammo: 12, reserve: 48, score: 0, shots: 0, hits: 0, relays: 0, hostiles: 0, startTime: 0, elapsed: 0, reloading: false, reloadAt: 0, extraction: false, crouch: false, sprint: false, messageId: 0 };
const input = { keys: new Set(), mouse: new THREE.Vector2(), firing: false, aiming: false };
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const colliders = [];
const relayObjects = [];
const enemies = [];
const particles = [];
let scene, camera, renderer, weapon, weaponBaseY, muzzleLight;
let yaw = 0, pitch = 0, lastShot = 0, audioContext, lean = 0;

const COLORS = { cyan: 0x8ce6d8, amber: 0xe8ac61, red: 0xf06e66, concrete: 0x293840, steel: 0x4a5c61 };
const level = { width: 54, depth: 42, playerStart: new THREE.Vector3(0, 1.7, 17), extraction: new THREE.Vector3(0, 0, 16.5) };

function mat(color, roughness = .72, metalness = .1, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emissive ? 1.4 : 0 });
}
function box(name, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name; mesh.position.copy(Array.isArray(position) ? new THREE.Vector3(...position) : position); mesh.castShadow = options.cast ?? true; mesh.receiveShadow = options.receive ?? true;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  scene.add(mesh);
  if (options.collider !== false) colliders.push({ min: new THREE.Vector3(mesh.position.x - size[0] / 2, mesh.position.y - size[1] / 2, mesh.position.z - size[2] / 2), max: new THREE.Vector3(mesh.position.x + size[0] / 2, mesh.position.y + size[1] / 2, mesh.position.z + size[2] / 2), mesh });
  return mesh;
}
function cylinder(name, radius, height, position, material, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.04, height, segments), material);
  mesh.name = name; mesh.position.copy(Array.isArray(position) ? new THREE.Vector3(...position) : position); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
}
function textSprite(text, color = '#8ce6d8') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const ctx = c.getContext('2d');
  ctx.font = '600 23px monospace'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(text, 128, 39);
  const texture = new THREE.CanvasTexture(c); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.scale.set(3.2, .8, 1); return sprite;
}
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const gl = renderer.getContext(); const debug = gl.getExtension('WEBGL_debug_renderer_info'); const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ''; const software = /swiftshader|llvmpipe|software/i.test(gpu);
  renderer.setPixelRatio(software ? .4 : Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = !software; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.documentElement.dataset.renderer = software ? 'software' : 'hardware';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  addEventListener('resize', () => { if (!camera) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
}
function setupScene() {
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x080f16); scene.fog = new THREE.Fog(0x080f16, 22, 68);
  camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, .05, 120); camera.position.copy(level.playerStart); camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0x8ca9ae, 0x12171c, 1.5));
  const moon = new THREE.DirectionalLight(0x9bb8ce, 2.2); moon.position.set(-18, 30, 10); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -30; moon.shadow.camera.right = 30; moon.shadow.camera.top = 30; moon.shadow.camera.bottom = -30; scene.add(moon);
  const cyanLight = new THREE.PointLight(COLORS.cyan, 12, 13, 2); cyanLight.position.set(-14, 4, -9); scene.add(cyanLight);
  buildArena(); buildWeapon(); buildRelays(); buildEnemies();
  if (document.documentElement.dataset.renderer === 'software') scene.traverse(object => { if (object.isPointLight && object !== muzzleLight) object.visible = false; });
}
function buildArena() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(level.width, level.depth), mat(0x101c22, .95, .02)); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -2); floor.receiveShadow = true; scene.add(floor);
  const extractionPad = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.1, 48), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: .8, side: THREE.DoubleSide })); extractionPad.rotation.x = -Math.PI / 2; extractionPad.position.set(0, .025, 16.5); scene.add(extractionPad);
  const extractionTag = textSprite('EXTRACTION', '#8ce6d8'); extractionTag.position.set(0, 2, 18); scene.add(extractionTag);
  const grid = new THREE.GridHelper(level.width, 27, 0x2a454a, 0x14242a); grid.position.set(0, .012, -2); grid.material.opacity = .2; grid.material.transparent = true; scene.add(grid);
  const wall = mat(0x18252b, .88, .2); box('north-wall', [level.width, 5, .8], [0, 2.5, -23], wall); box('west-wall', [.8, 5, level.depth], [-27, 2.5, -2], wall); box('east-wall', [.8, 5, level.depth], [27, 2.5, -2], wall);
  const back = box('south-wall', [level.width, 5, .8], [0, 2.5, 19], wall); back.material = mat(0x26343a, .8, .35);
  const cover = mat(0x26333a, .8, .3); const marked = mat(0x33434a, .7, .5);
  [[-15, -14, 7, 2.7, 2.5], [8, -15, 5, 2.8, 2.4], [17, -4, 3, 2.5, 5], [-19, -1, 4.5, 2.5, 2.5], [-8, 7, 6, 2.5, 2.3], [10, 8, 5, 2.6, 2.4], [18, 12, 4, 2.8, 2.4], [-17, 13, 5, 2.6, 2.4]].forEach(([x, z, w, h, d], i) => box('cover-' + i, [w, h, d], [x, h / 2, z], i % 3 === 0 ? marked : cover));
  [[-23, -19], [-11, -19], [2, -20], [14, -19], [23, -15], [-24, 8], [25, 5]].forEach(([x, z], i) => { const lamp = new THREE.PointLight(i % 2 ? COLORS.amber : COLORS.cyan, 8, 8, 2); lamp.position.set(x, 3.7, z); scene.add(lamp); cylinder('lamp-' + i, .07, 3.8, [x, 1.9, z], mat(COLORS.steel, .4, .8), 8); });
  // Painted tactical arrows and safety striping keep the arena readable.
  for (let z = -20; z <= 15; z += 4) box('lane-mark', [.08, .008, 1.7], [-1.8, .02, z], mat(0x59726f, .6, 0), { collider: false, cast: false });
  for (let x = -22; x <= 22; x += 4) box('dock-mark', [1.7, .008, .08], [x, .021, -2], mat(0x8f693d, .6, 0), { collider: false, cast: false });
}
function buildWeapon() {
  weapon = new THREE.Group(); weapon.position.set(.34, -.31, -.67); camera.add(weapon); weaponBaseY = weapon.position.y;
  const dark = mat(0x172027, .38, .72), black = mat(0x080d11, .3, .75), accent = mat(COLORS.cyan, .35, .62, COLORS.cyan);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.16, .15, .7), dark); body.position.z = -.1; weapon.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(.11, .3, .16), black); grip.position.set(0, -.18, .08); grip.rotation.x = -.18; weapon.add(grip);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .78, 10), black); barrel.rotation.x = Math.PI / 2; barrel.position.z = -.57; weapon.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(.045, .06, .23), accent); sight.position.set(0, .13, -.18); weapon.add(sight);
  muzzleLight = new THREE.PointLight(COLORS.amber, 0, 4); muzzleLight.position.z = -.95; weapon.add(muzzleLight);
}
function buildRelays() {
  [[-21, -16, 'A'], [19, -7, 'B'], [-15, 10, 'C']].forEach(([x, z, label], i) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.userData = { label, secured: false, index: i }; scene.add(group);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, .16, .8), mat(0x1b2c31, .55, .65)); base.position.y = .08; group.add(base);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.2, .15), mat(0x31494b, .45, .72)); mast.position.y = 1.15; group.add(mast);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(.52, .42, .06), mat(COLORS.amber, .32, .15, COLORS.amber)); screen.position.set(0, 1.3, -.12); group.add(screen);
    const beacon = new THREE.PointLight(COLORS.amber, 2.5, 6); beacon.position.set(0, 1.5, 0); group.add(beacon);
    const tag = textSprite(`RELAY ${label}`, '#e8ac61'); tag.position.set(0, 2.7, 0); group.add(tag);
    relayObjects.push({ group, screen, beacon, label, secured: false });
  });
}
function buildEnemies() {
  [[-5, -17], [14, -13], [-20, -5], [4, 1], [21, 5], [-5, 14], [12, 15]].forEach(([x, z], index) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.userData = { index, health: 100, state: 'patrol', patrol: new THREE.Vector3(x, 0, z), alive: true, alert: 0, fireAt: 0, phase: index * .73 }; scene.add(group);
    const enemyMat = mat(0x152126, .85, .25), vest = mat(index % 2 ? 0x37483e : 0x323b47, .88, .12), visor = mat(COLORS.red, .25, .65, COLORS.red);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.34, .75, .3), enemyMat); legs.position.y = .42; group.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.72, .85, .38), vest); torso.position.y = 1.08; group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.38, .4, .38), enemyMat); head.position.y = 1.7; group.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(.23, .05, .015), visor); eye.position.set(0, 1.72, -.2); group.add(eye);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .65), enemyMat); gun.position.set(.42, 1.04, -.3); gun.rotation.x = -.2; group.add(gun);
    const marker = textSprite('!', '#f06e66'); marker.scale.set(.65, .65, 1); marker.position.y = 2.42; marker.visible = false; group.add(marker);
    group.userData.marker = marker; group.userData.hitMeshes = [torso, head, legs]; enemies.push(group);
  }); state.hostiles = enemies.length;
}
function resetGame() {
  state.running = true; state.paused = false; state.ended = false; state.health = 100; state.ammo = 12; state.reserve = 48; state.score = 0; state.shots = 0; state.hits = 0; state.relays = 0; state.hostiles = enemies.length; state.startTime = performance.now(); state.elapsed = 0; state.reloading = false; state.extraction = false; lastShot = -10000; state.smoke = 2; particles.splice(0).forEach(p => { scene.remove(p); p.geometry.dispose(); p.material.dispose(); }); enemies.forEach(e => e.userData.fireAt = 0); input.firing = false; input.aiming = false; input.keys.clear();
  camera.position.copy(level.playerStart); yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0); relayObjects.forEach(r => { r.secured = false; r.screen.material.emissive.setHex(COLORS.amber); r.beacon.color.setHex(COLORS.amber); r.beacon.intensity = 2.5; });
  const spawnPoints = [[-5, -17], [14, -13], [-20, -5], [4, 1], [21, 5], [-5, 14], [12, 15]];
  enemies.forEach((enemy, i) => { enemy.userData.health = 100; enemy.userData.alive = true; enemy.userData.state = 'patrol'; enemy.userData.alert = 0; enemy.visible = true; enemy.position.set(spawnPoints[i][0], 0, spawnPoints[i][1]); enemy.userData.patrol.set(spawnPoints[i][0], 0, spawnPoints[i][1]); enemy.userData.marker.visible = false; }); state.hostiles = enemies.length;
  document.querySelector('#objective-text').textContent = 'SECURE THE RELAY NETWORK'; showMessage('MOVE QUIET // STAY IN COVER', 2100); updateHud();
}
function startGame() { boot.classList.add('hidden'); hud.classList.remove('hidden'); resetGame(); canvas.focus(); canvas.requestPointerLock?.(); }
function updateHud() {
  const sec = Math.floor(state.elapsed / 1000); const time = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; document.querySelector('#mission-time').textContent = time;
  document.querySelector('#health-value').textContent = Math.max(0, Math.ceil(state.health)); document.querySelector('#health-bar').style.width = `${Math.max(0, state.health)}%`; document.querySelector('#ammo-value').textContent = String(state.ammo).padStart(2, '0'); document.querySelector('#objective-progress').style.width = `${state.relays / 3 * 100}%`; document.querySelector('#heading').textContent = String(Math.round(((THREE.MathUtils.radToDeg(yaw) % 360) + 360) % 360)).padStart(3, '0');
  document.querySelector('#stance-text').textContent = state.crouch ? 'CROUCHING' : state.sprint ? 'SPRINTING' : 'STANDING'; document.querySelector('#stance-dot').style.background = state.sprint ? '#e8ac61' : '#8ce6d8'; document.querySelector('#weapon-mode').textContent = state.reloading ? 'RELOAD' : 'SEMI';
  const threat = Math.min(5, enemies.filter(e => e.userData.alive && e.userData.state === 'alert').length + (state.extraction ? 2 : 0)); document.querySelector('#threat-text').textContent = ['LOW', 'ELEVATED', 'WATCHED', 'HIGH', 'CRITICAL', 'MAXIMUM'][threat]; document.querySelectorAll('.signal-bars i').forEach((el, i) => el.classList.toggle('active', i < Math.max(1, threat)));
}
function showMessage(message, duration = 2000) { const el = document.querySelector('#center-message'); el.textContent = message; el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop'); window.clearTimeout(state.messageId); state.messageId = window.setTimeout(() => el.classList.add('hidden'), duration); }
function showToast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 1700); }
function isBlocked(position, radius = .35) { return colliders.some(c => position.x > c.min.x - radius && position.x < c.max.x + radius && position.z > c.min.z - radius && position.z < c.max.z + radius); }
function movePlayer(delta) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); const move = new THREE.Vector3();
  if (input.keys.has('KeyW')) move.addScaledVector(forward, -1); if (input.keys.has('KeyS')) move.add(forward); if (input.keys.has('KeyD')) move.add(right); if (input.keys.has('KeyA')) move.sub(right);
  state.crouch = input.keys.has('ControlLeft') || input.keys.has('ControlRight'); state.sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'); if (move.lengthSq()) move.normalize(); const speed = state.crouch ? 2.1 : state.sprint && !input.aiming ? 6.7 : 4.2; move.multiplyScalar(speed * delta);
  const nextX = camera.position.clone(); nextX.x += move.x; if (!isBlocked(nextX, .45)) camera.position.x = THREE.MathUtils.clamp(nextX.x, -25.4, 25.4); const nextZ = camera.position.clone(); nextZ.z += move.z; if (!isBlocked(nextZ, .45)) camera.position.z = THREE.MathUtils.clamp(nextZ.z, -21.5, 17.5); camera.position.y = state.crouch ? 1.12 : 1.7;
}
function shoot() {
  if (!state.running || state.paused || state.ended || state.reloading || state.ammo <= 0) { if (state.ammo <= 0 && !state.reloading) reload(); return; }
  const now = performance.now(); if (now - lastShot < 170) return; lastShot = now; state.ammo--; state.shots++; pitch = Math.max(-1.35, pitch - .014); weapon.position.z = -.59; muzzleLight.intensity = 11; setTimeout(() => muzzleLight && (muzzleLight.intensity = 0), 46); playBeep(180, .035);
  scene.updateMatrixWorld(true); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const targets = enemies.flatMap(e => e.userData.alive ? e.userData.hitMeshes : []); const hit = raycaster.intersectObjects([...targets, ...colliders.map(c => c.mesh)], false)[0];
  if (hit) { const enemy = enemies.find(e => e.userData.hitMeshes.includes(hit.object)); if (enemy) { state.hits++; enemy.userData.health -= 50; enemy.userData.state = 'alert'; enemy.userData.alert = 3; if (enemy.userData.health <= 0) killEnemy(enemy); else showMessage('CONTACT HIT', 600); } }
  updateHud();
}
function killEnemy(enemy) { enemy.userData.alive = false; enemy.visible = false; state.hostiles--; state.score += 100; spawnBurst(enemy.position.clone().add(new THREE.Vector3(0, 1.4, 0)), COLORS.red); showMessage('HOSTILE DOWN', 900); }
function reload() { if (!state.running || state.paused || state.ended) return; if (state.reloading || state.ammo === 12 || state.reserve <= 0) return; state.reloading = true; state.reloadAt = performance.now() + 1300; showToast('RELOADING // COVER'); updateHud(); }
function deploySmoke() {
  if (!state.running || state.paused || state.ended || state.smoke <= 0) return;
  state.smoke--;
  const targetPosition = camera.position.clone();
  const targetDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  targetPosition.addScaledVector(targetDirection, 3.2);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb9c9c8, transparent: true, opacity: .22, depthWrite: false }));
  smoke.position.copy(targetPosition); smoke.userData.life = 8; smoke.userData.smoke = true; scene.add(smoke); particles.push(smoke);  showToast('SMOKE DEPLOYED // SIGHTLINES BROKEN');
}
function interact() {
  if (!state.running || state.paused || state.ended) return;
  const p = camera.position;
  const relay = relayObjects.find(r => !r.secured && r.group.position.distanceTo(p) < 3.1);
  if (relay) { relay.secured = true; relay.screen.material.emissive.setHex(COLORS.cyan); relay.beacon.color.setHex(COLORS.cyan); relay.beacon.intensity = 4; state.relays++; state.score += 250; showMessage(`RELAY ${relay.label} SECURED`, 1500); playBeep(620, .08); if (state.relays === 3) { state.extraction = true; document.querySelector('#objective-text').textContent = 'REACH THE EXTRACTION ZONE'; showMessage('ALL RELAYS LIVE // MOVE TO EXTRACTION', 3000); } updateHud(); return; }
  if (state.extraction && p.distanceTo(level.extraction) < 4.2) finishMission(true);
}
function updateEnemies(delta, time) {
  enemies.forEach(enemy => {
    const data = enemy.userData; if (!data.alive) return; const toPlayer = camera.position.clone().sub(enemy.position); const dist = toPlayer.length(); const heard = state.sprint && dist < 10 || performance.now() - lastShot < 800 && dist < 21; if (heard) data.alert = Math.max(data.alert, 1.3); const sees = dist < (state.crouch ? 12 : 18) && hasLineOfSight(enemy.position, camera.position);
    if (sees) { data.alert = Math.min(4, data.alert + delta * (state.sprint ? 1.7 : .7)); if (data.alert > 1.25) data.state = 'alert'; }
    else data.alert = Math.max(0, data.alert - delta * .2);
    if (data.alert > 1.25) data.state = 'alert'; data.marker.visible = data.state === 'alert';
    if (data.state === 'alert') { enemy.rotation.set(0, Math.atan2(toPlayer.x, toPlayer.z) + Math.PI, 0); if (sees && dist < 15 && time > data.fireAt) { data.fireAt = time + 850 + data.phase * 100; spawnTracer(enemy.position.clone().add(new THREE.Vector3(0,1.2,0)), camera.position); takeDamage(7 + Math.random() * 5); } if (!sees && data.alert < .2) data.state = 'patrol'; }
    else { const target = data.patrol.clone(); target.x += Math.sin(time * .00035 + data.phase) * 2.8; target.z += Math.cos(time * .00032 + data.phase) * 2.1; enemy.rotation.set(0, Math.atan2(target.x-enemy.position.x,target.z-enemy.position.z)+Math.PI,0); enemy.position.lerp(target, delta * .25); }
  });
}
function hasLineOfSight(from, to) { if (particles.some(p => p.userData.smoke && segmentNearSphere(from, to, p.position, 2.8))) return false; const origin = from.clone().add(new THREE.Vector3(0, 1.3, 0)); const direction = to.clone().sub(origin).normalize(); raycaster.set(origin, direction); const hit = raycaster.intersectObjects(colliders.map(c => c.mesh), false)[0]; return !hit || hit.distance > from.distanceTo(to) - .5; }
function segmentNearSphere(a,b,center,radius) { const ab=b.clone().sub(a), t=THREE.MathUtils.clamp(center.clone().sub(a).dot(ab)/Math.max(.001,ab.lengthSq()),0,1); return a.clone().addScaledVector(ab,t).distanceTo(center)<radius; }
function takeDamage(amount) { if (state.ended) return; state.health -= amount; const flash = document.querySelector('#damage-flash'); flash.style.opacity = '.72'; setTimeout(() => flash.style.opacity = '0', 120); if (state.health <= 0) finishMission(false); updateHud(); }
function checkObjective() { const near = relayObjects.some(r => !r.secured && r.group.position.distanceTo(camera.position) < 3.1); const extract = state.extraction && camera.position.distanceTo(level.extraction) < 4.2; document.querySelector('#interaction-prompt').classList.toggle('hidden', !(near || extract)); document.querySelector('#interaction-prompt span').textContent = extract ? 'EXTRACT' : near ? 'SECURE RELAY' : 'INTERACT'; }
function finishMission(success) { state.ended = true; state.running = false; input.keys.clear(); input.firing = false; if (document.pointerLockElement) document.exitPointerLock(); end.classList.remove('hidden'); document.querySelector('#end-kicker').textContent = success ? 'MISSION REPORT // CLEAN EXIT' : 'MISSION REPORT // SIGNAL LOST'; document.querySelector('#end-title').textContent = success ? 'EXTRACTION COMPLETE' : 'OPERATOR DOWN'; document.querySelector('#end-copy').textContent = success ? 'The relays are dark. Your route out is clear.' : 'The line collapsed before the package was secured. Reset and try a quieter route.'; const sec = Math.floor(state.elapsed / 1000); document.querySelector('#end-time').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; document.querySelector('#end-hostiles').textContent = String(state.hostiles).padStart(2, '0'); document.querySelector('#end-accuracy').textContent = `${state.shots ? Math.round(state.hits / state.shots * 100) : 0}%`; }
function spawnTracer(from, to) { const length = from.distanceTo(to); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,length,4), new THREE.MeshBasicMaterial({color:COLORS.amber,transparent:true,opacity:.7})); mesh.position.copy(from).lerp(to,.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize()); mesh.userData.life=.06; scene.add(mesh); particles.push(mesh); }
function spawnBurst(position, color) { for (let i = 0; i < 8; i++) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .16), mat(color, .4, .2, color)); mesh.position.copy(position); mesh.userData.life = .5 + i * .03; mesh.userData.velocity = new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 2.5, (Math.random() - .5) * 3); scene.add(mesh); particles.push(mesh); } }
function updateParticles(delta) { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.userData.life -= delta; if (p.userData.velocity) { p.position.addScaledVector(p.userData.velocity, delta); p.userData.velocity.y -= 5 * delta; } p.material.opacity = p.userData.smoke ? Math.min(.22, p.userData.life * .08) : Math.max(0, p.userData.life * 2); p.material.transparent = true; if (p.userData.life <= 0) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); particles.splice(i, 1); } } }
function drawMinimap() { const c = document.querySelector('#minimap'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = 'rgba(6,14,18,.7)'; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = 'rgba(140,230,216,.3)'; ctx.strokeRect(8, 8, 164, 164); const sx = 164 / 54, sz = 164 / 42; const px = 8 + (camera.position.x + 27) * sx, pz = 8 + (camera.position.z + 23) * sz; ctx.strokeStyle = 'rgba(140,230,216,.18)'; colliders.forEach(collider => { const x = 8 + (collider.min.x + 27) * sx, z = 8 + (collider.min.z + 23) * sz; ctx.strokeRect(x, z, (collider.max.x - collider.min.x) * sx, (collider.max.z - collider.min.z) * sz); }); relayObjects.forEach(r => { ctx.fillStyle = r.secured ? '#8ce6d8' : '#e8ac61'; ctx.fillRect(8 + (r.group.position.x + 27) * sx - 3, 8 + (r.group.position.z + 23) * sz - 3, 6, 6); }); enemies.forEach(e => { if (!e.userData.alive || e.userData.state !== 'alert') return; ctx.fillStyle = '#f06e66'; ctx.beginPath(); ctx.arc(8 + (e.position.x + 27) * sx, 8 + (e.position.z + 23) * sz, 3, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = '#d7e2e3'; ctx.beginPath(); ctx.arc(px, pz, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#d7e2e3'; ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(px - Math.sin(yaw) * 10, pz - Math.cos(yaw) * 10); ctx.stroke(); }
function playBeep(freq, duration) { try { audioContext ||= new AudioContext(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.frequency.value = freq; oscillator.type = 'square'; gain.gain.setValueAtTime(.025, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); } catch {} }
function loop() { requestAnimationFrame(loop); const delta = Math.min(clock.getDelta(), .05); if (state.running && !state.paused && !state.ended) { state.elapsed += delta * 1000; movePlayer(delta); if (state.reloading && performance.now() >= state.reloadAt) { const refill = Math.min(12 - state.ammo, state.reserve); state.ammo += refill; state.reserve -= refill; state.reloading = false; } lean = THREE.MathUtils.lerp(lean, input.keys.has('KeyQ') ? .14 : input.keys.has('KeyF') ? -.14 : 0, delta * 10); camera.rotation.set(pitch, yaw, lean); camera.fov = THREE.MathUtils.lerp(camera.fov, input.aiming ? 48 : 76, delta * 12); camera.updateProjectionMatrix(); weapon.position.z = THREE.MathUtils.lerp(weapon.position.z, -.67, delta * 14); weapon.position.x = THREE.MathUtils.lerp(weapon.position.x, input.aiming ? 0 : .34, delta * 12); document.querySelector('#reload-progress').style.width = state.reloading ? `${Math.max(0, 1 - (state.reloadAt - performance.now()) / 1300) * 100}%` : '0%'; document.querySelector('.ammo span').textContent = `/ ${state.reserve}`; /* The K-9 fires once per click. */ updateEnemies(delta, performance.now()); updateParticles(delta); checkObjective(); updateHud(); drawMinimap(); weapon.position.y = weaponBaseY + Math.sin(state.elapsed * .007) * (state.sprint ? .018 : .007); }
  if (renderer) renderer.render(scene, camera);
}

addEventListener('keydown', event => { if (['Space', 'ControlLeft', 'ControlRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault(); input.keys.add(event.code); if (event.code === 'KeyE') interact(); if (event.code === 'KeyR') reload(); if (event.code === 'KeyG') deploySmoke(); if (event.code === 'Escape' && state.running && !state.ended) { state.paused = true; pause.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); } });
addEventListener('keyup', event => input.keys.delete(event.code));
addEventListener('mousemove', event => { if (!state.running || state.paused || document.pointerLockElement !== canvas) return; yaw -= event.movementX * .0022; pitch = THREE.MathUtils.clamp(pitch - event.movementY * .0022, -1.35, 1.35); camera.rotation.set(pitch, yaw, 0); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', event => { if (event.button === 2) input.aiming = true; if (event.button === 0) { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); input.firing = true; shoot(); } }); addEventListener('mouseup', () => { input.firing = false; input.aiming = false; });
document.querySelector('#start-button').addEventListener('click', startGame); document.querySelector('#resume-button').addEventListener('click', () => { state.paused = false; pause.classList.add('hidden'); canvas.requestPointerLock?.(); }); document.querySelector('#restart-button').addEventListener('click', () => { end.classList.add('hidden'); startGame(); });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && state.running && !state.ended) { state.paused = true; input.firing = false; input.keys.clear(); pause.classList.remove('hidden'); } });
addEventListener('blur', () => { input.keys.clear(); input.firing = false; if (state.running) { state.paused = true; pause.classList.remove('hidden'); } });
try { setupRenderer(); setupScene(); loop(); } catch (error) { document.querySelector('.dek').textContent = 'WebGL 2 unavailable. Enable browser hardware acceleration and reload.'; document.querySelector('#start-button').disabled = true; console.error(error); }
// Explicit local QA route. Absent during normal play.
if (new URLSearchParams(location.search).has('qa')) window.__qa = { state, get camera() { return camera; }, get enemies() { return enemies; }, teleport(x,z) { camera.position.set(x,1.7,z); }, aim(x,y,z) { camera.lookAt(x,y,z); yaw = camera.rotation.y; pitch = camera.rotation.x; }, shoot, interact, takeDamage, resetGame, get colliders() { return colliders; }, get smokeCount() { return particles.filter(p => p.userData.smoke).length; }, hasLineOfSight, isBlocked, renderer, segmentNearSphere };
