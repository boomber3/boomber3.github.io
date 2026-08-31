import * as THREE from 'three';
import { camera, scene } from '../core/engine.js';
import { state } from '../core/state.js';
import { gltfLoader } from '../world/props.js';
import { qteLineZoneData } from './fart-qte.js';

const burgerRoot = new THREE.Group();
burgerRoot.visible = false;
burgerRoot.renderOrder = 9000;
camera.add(burgerRoot);
scene.add(camera);

let burgerModel = null;
let burgerLoaded = false;
let currentTint = '';
const originalColors = [];

function normalizeModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSide = Math.max(size.x, size.y, size.z, 0.001);
  root.position.sub(center);
  root.scale.setScalar(1 / maxSide);
}

function captureMaterials(root) {
  originalColors.length = 0;
  root.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    obj.material = Array.isArray(obj.material) ? mats.map(mat => mat.clone()) : obj.material.clone();
    const cloned = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of cloned) {
      if (!mat.color) continue;
      originalColors.push({ mat, color: mat.color.clone() });
    }
  });
}

async function loadMediumRareBurgerModel() {
  if (burgerLoaded) return;
  burgerLoaded = true;
  try {
    const gltf = await gltfLoader.loadAsync('assets/food-events/medium-rare-burger.glb');
    burgerModel = gltf.scene;
    normalizeModel(burgerModel);
    captureMaterials(burgerModel);
    burgerRoot.add(burgerModel);
  } catch (err) {
    console.warn('Medium Rare Burger model failed to load:', err);
  }
}

function setBurgerTint(kind) {
  if (kind === currentTint) return;
  currentTint = kind;
  const tint = kind === 'raw'
    ? new THREE.Color('#ff6a5a')
    : kind === 'burnt'
      ? new THREE.Color('#2b160f')
      : new THREE.Color('#ffffff');
  const intensity = kind === 'raw' ? 0.48 : kind === 'burnt' ? 0.82 : 0;
  for (const item of originalColors) {
    item.mat.color.copy(item.color).lerp(tint, intensity);
  }
}

function burgerCookKind() {
  const zone = state.pendingMediumRareZone || qteLineZoneData()?.q;
  if (zone === 'raw') return 'raw';
  if (zone === 'burnt') return 'burnt';
  return 'medium';
}

function updateMediumRareBurger(t) {
  const active = state.activeFoodEvent?.id === 'mediumRareBurger10' &&
    (state.phase === 'opening' || state.phase === 'run');
  burgerRoot.visible = active && !!burgerModel;
  if (!burgerRoot.visible) return;

  const d = 5;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
  const halfW = halfH * camera.aspect;
  burgerRoot.position.set(-halfW * 0.72, halfH * 0.58, -d);
  burgerRoot.scale.setScalar(Math.min(0.575, halfH * 0.25));
  burgerRoot.rotation.set(-0.28, 0.55 + Math.sin(t * 1.6) * 0.12, 0.08);
  setBurgerTint(burgerCookKind());
}

export { loadMediumRareBurgerModel, updateMediumRareBurger };
