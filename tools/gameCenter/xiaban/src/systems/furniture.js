import * as THREE from 'three';
import { scene, camera } from '../core/engine.js';
import { state } from '../core/state.js';

const FURNITURE_FILES = [
  'bedDouble.png',
  'bench.png',
  'dryer.png',
  'kitchenBar.png',
  'kitchenBarEnd.png',
  'kitchenCabinet.png',
  'kitchenFridgeBuiltIn.png',
  'loungeChair.png',
  'loungeDesignSofa.png',
  'stoolBar.png',
  'tableCloth.png',
  'tableCoffeeGlass.png',
  'tableRound.png',
  'televisionVintage.png',
  'toiletSquare.png',
  'washer.png',
  'washerDryerStacked.png',
];

const loader = new THREE.TextureLoader();
const materials = {};
const furniture = [];
let loading = false;
let loadedCount = 0;

const planeGeo = new THREE.PlaneGeometry(1, 1);
const tagMat = new THREE.MeshBasicMaterial({ color: '#ffd21a', side: THREE.DoubleSide, depthTest: true, depthWrite: false });
const tagStripeMat = new THREE.MeshBasicMaterial({ color: '#1765d1', side: THREE.DoubleSide, depthTest: true, depthWrite: false });

function loadFurnitureTextures() {
  if (loading) return;
  loading = true;
  for (const file of FURNITURE_FILES) {
    loader.load(
      `assets/furniture/${file}`,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        materials[file] = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: false,
        });
        loadedCount++;
      },
      undefined,
      e => console.warn('[furniture] 家具贴图加载失败:', file, e)
    );
  }
}

function pickFile() {
  return FURNITURE_FILES[(Math.random() * FURNITURE_FILES.length) | 0];
}

function makeFurniture() {
  const group = new THREE.Group();
  const sprite = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false }));
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.13), tagMat);
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.035), tagStripeMat);
  tag.position.set(0.34, 0.28, 0.012);
  stripe.position.set(0.34, 0.315, 0.018);
  group.add(sprite, tag, stripe);
  group.visible = false;
  scene.add(group);
  return {
    mesh: group,
    sprite,
    tag,
    stripe,
    life: 0,
    age: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    orbitT: 0,
    phase: 0,
    spin: 0,
    wobble: 0,
    wobbleSpeed: 0,
    band: 0,
    radius: 0,
    w: 1,
    h: 1,
    settled: false,
    pileFloor: 0,
    bounces: 0,
    layer: 0,
  };
}

function spawnFurniture(x, y, burst = 1) {
  const file = pickFile();
  const mat = materials[file];
  if (!mat) {
    loadFurnitureTextures();
    return false;
  }
  let f = furniture.find(o => o.life <= 0);
  if (!f) {
    if (furniture.length >= 280) return false;
    f = makeFurniture();
    furniture.push(f);
  }
  const img = mat.map.image;
  const aspect = img && img.height ? img.width / img.height : 1;
  const baseH = 0.9 + Math.random() * 0.58;
  f.sprite.material = mat;
  f.w = baseH * aspect;
  f.h = baseH;
  f.sprite.scale.set(f.w, f.h, 1);
  f.mesh.visible = true;
  f.life = 7.2 + Math.random() * 1.4;
  f.age = 0;
  f.orbitT = 0;
  f.phase = Math.random() * Math.PI * 2;
  f.spin = (Math.random() - 0.5) * 14;
  f.wobble = Math.random() * Math.PI * 2;
  f.wobbleSpeed = 2.2 + Math.random() * 3.5;
  f.band = Math.random();
  f.radius = 0.65 + f.band * 1.55 + Math.random() * 0.45;
  f.settled = false;
  f.bounces = 0;
  f.layer = (Math.random() * 8) | 0;
  f.pileFloor = f.h * (0.26 + Math.random() * 0.18) + Math.pow(Math.random(), 1.9) * 1.15;
  const angle = Math.random() * Math.PI * 2;
  const speed = (4.4 + Math.random() * 6.2) * burst;
  f.vx = Math.cos(angle) * speed * 0.96 + (Math.random() - 0.5) * 1.8;
  f.vy = Math.sin(angle) * speed * 0.76 + 2.4 + Math.random() * 2.7;
  if (f.vy < 1.6) f.vy += 2.6;
  f.vz = (Math.random() - 0.5) * (3.4 + Math.random() * 2.2);
  f.mesh.position.set(
    x + (Math.random() - 0.5) * 0.5,
    y + Math.random() * 0.42,
    (Math.random() - 0.5) * 0.55
  );
  f.mesh.rotation.set(0, 0, Math.random() * Math.PI * 2);
  f.mesh.renderOrder = 30 + f.layer;
  f.sprite.renderOrder = 30 + f.layer;
  f.tag.renderOrder = 31 + f.layer;
  f.stripe.renderOrder = 32 + f.layer;
  return true;
}

function spawnFurnitureBurst(x, y, n, burst = 1) {
  const count = Math.max(1, Math.round(n * (state.specialAmountMul || 1)));
  for (let i = 0; i < count; i++) spawnFurniture(x, y, burst);
}

function updateFurniture(dt) {
  for (const f of furniture) {
    if (f.life <= 0) continue;
    f.age += dt;
    f.life -= dt;
    const minX = camera.position.x - 7.25;
    const maxX = camera.position.x + 7.25;
    const maxY = 5.35;
    const minZ = -2.15;
    const maxZ = 2.15;
    if (f.settled) {
      f.mesh.position.x = THREE.MathUtils.clamp(f.mesh.position.x, minX - 3, maxX - 3);
      f.mesh.position.y = f.pileFloor + Math.sin(f.wobble + f.age * 1.7) * 0.018;
      f.mesh.position.z = THREE.MathUtils.clamp(f.mesh.position.z, minZ, maxZ);
      f.mesh.rotation.y = Math.sin(f.wobble + f.age * 1.2) * 0.08;
    } else {
      f.vy -= 12.4 * dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation.y += Math.sin(f.age * 4 + f.band) * dt * 1.8;
      f.mesh.rotation.z += f.spin * dt * 1.8;
      if (f.mesh.position.x < minX && f.vx < 0) {
        f.mesh.position.x = minX;
        f.vx = -f.vx * 0.42;
        f.spin *= -0.65;
      } else if (f.mesh.position.x > maxX && f.vx > 0) {
        f.mesh.position.x = maxX;
        f.vx = -f.vx * 0.42;
        f.spin *= -0.65;
      }
      if (f.mesh.position.z < minZ && f.vz < 0) {
        f.mesh.position.z = minZ;
        f.vz = -f.vz * 0.45;
      } else if (f.mesh.position.z > maxZ && f.vz > 0) {
        f.mesh.position.z = maxZ;
        f.vz = -f.vz * 0.45;
      }
      if (f.mesh.position.y > maxY && f.vy > 0) {
        f.mesh.position.y = maxY;
        f.vy = -f.vy * 0.28;
        f.vx *= 0.86;
        f.vz *= 0.86;
      }
      if (f.mesh.position.y <= f.pileFloor && f.vy < 0) {
        f.mesh.position.y = f.pileFloor;
        f.bounces++;
        if (f.bounces >= 2 || Math.abs(f.vy) < 2.2) {
          f.settled = true;
          f.vx = 0;
          f.vy = 0;
          f.vz = 0;
          f.spin = 0;
          f.mesh.rotation.z += (Math.random() - 0.5) * 0.35;
        } else {
          f.vy = -f.vy * 0.28;
          f.vx *= 0.48;
          f.vz *= 0.5;
          f.spin *= 0.55;
        }
      }
    }
    if (f.life <= 0) {
      f.life = 0;
      f.mesh.visible = false;
    }
  }
}

function furnitureDebugInfo() {
  return {
    loaded: loadedCount,
    active: furniture.filter(f => f.life > 0).length,
  };
}

export { loadFurnitureTextures, spawnFurnitureBurst, updateFurniture, furnitureDebugInfo };
