import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getStructureDefinition } from "@/engine/catalogue";
import {
  lonLatToWorld,
  parcelCellToWorld,
  PARCEL_CELL_M,
  PARCEL_GRID_SIZE,
  tileBounds,
  tileSizeM,
  worldToParcelCell,
  worldToTile,
  type WorldPoint,
} from "@/engine/geodesy";
import { heightAtM, sampleTerrain, type Biome } from "@/engine/terrain";
import type { ParcelDTO, StructureDTO } from "@/lib/types";

export const RELIEF_SCALE = 1.35;
export const TILE_ZOOM = 15;
export const TILE_SEGMENTS = 26;
export type RenderMode = "FLAT" | "STACK" | "RASTER";

export type WorldCallbacks = {
  onHoverCell: (cell: { x: number; y: number } | null) => void;
  onPickCell: (cell: { x: number; y: number }) => void;
  onPickStructure: (structureId: string) => void;
  onTileStatus: (loaded: number, total: number) => void;
};

export type WorldState = {
  seed: number;
  center: WorldPoint;
  parcel: ParcelDTO | null;
  structures: StructureDTO[];
  mode: RenderMode;
};

const waterDeep = new THREE.Color("#174b68");
const waterShallow = new THREE.Color("#4d9eb5");
const sandLow = new THREE.Color("#777b75");
const sandHigh = new THREE.Color("#b1b2a3");
const landLow = new THREE.Color("#365c47");
const landHigh = new THREE.Color("#86a66c");
const parcelCenter = (parcel: ParcelDTO): WorldPoint => ({ x: parcel.centerX, y: parcel.centerY });

function rampColor(biome: Biome, height: number, canopy: number): THREE.Color {
  if (["deep_sea", "sea", "lake"].includes(biome)) {
    return waterDeep.clone().lerp(waterShallow, THREE.MathUtils.clamp(1 + height / 240, 0.08, 0.95));
  }
  if (["coast", "desert"].includes(biome)) {
    return sandLow.clone().lerp(sandHigh, THREE.MathUtils.clamp(height / 280 + 0.25, 0, 1));
  }
  return landLow.clone().lerp(landHigh, THREE.MathUtils.clamp(canopy * 0.65 + Math.max(0, height) / 1700, 0.08, 0.95));
}

function makeTerrainGeometry(
  tile: { z: number; x: number; y: number },
  center: WorldPoint,
  seed: number,
  localGround: (x: number, z: number) => number,
  withColors: boolean,
): THREE.BufferGeometry {
  const bounds = tileBounds(tile);
  const size = tileSizeM(tile.z);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= TILE_SEGMENTS; row += 1) {
    for (let column = 0; column <= TILE_SEGMENTS; column += 1) {
      const u = column / TILE_SEGMENTS;
      const v = row / TILE_SEGMENTS;
      const globalX = bounds.minX + u * size;
      const globalY = bounds.maxY - v * size;
      const localX = globalX - center.x;
      const localZ = center.y - globalY;
      const ground = localGround(localX, localZ);
      positions.push(localX, ground + (withColors ? 0 : 1.4), localZ);
      uvs.push(u, 1 - v);
      if (withColors) {
        const sample = sampleTerrain(globalX, globalY, seed);
        const color = rampColor(sample.biome, sample.height, sample.canopy);
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  for (let row = 0; row < TILE_SEGMENTS; row += 1) {
    for (let column = 0; column < TILE_SEGMENTS; column += 1) {
      const a = row * (TILE_SEGMENTS + 1) + column;
      const b = a + 1;
      const c = a + TILE_SEGMENTS + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (withColors) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export class WorldRenderer {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 2, 24_000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly terrainGroup = new THREE.Group();
  private readonly rasterGroup = new THREE.Group();
  private readonly structureGroup = new THREE.Group();
  private readonly parcelGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly pickMeshes: THREE.Mesh[] = [];
  private readonly rasterMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly baseMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly keys = new Set<string>();
  private readonly avatar = new THREE.Group();
  private readonly cellHighlight: THREE.LineSegments;
  private readonly resizeObserver: ResizeObserver;
  private callbacks: WorldCallbacks;
  private state: WorldState;
  private animationFrame = 0;
  private previousTime = performance.now();
  private pointerDown = { x: 0, y: 0 };
  private structureSignature = "";
  private terrainSignature = "";
  private avatarPosition = new THREE.Vector3(0, 0, 0);
  private water: THREE.Mesh | null = null;
  private disposed = false;

  constructor(container: HTMLElement, initial: WorldState, callbacks: WorldCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.state = initial;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#101d24");
    this.renderer.domElement.className = "world-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional terrain. Drag to orbit, scroll to zoom, use W A S D to move the pilot.");
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog("#101d24", 4200, 11_000);
    this.scene.add(this.terrainGroup, this.rasterGroup, this.structureGroup, this.parcelGroup, this.avatar);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 280;
    this.controls.maxDistance = 6800;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.screenSpacePanning = false;
    this.cellHighlight = this.makeCellHighlight();
    this.scene.add(this.cellHighlight);
    this.cellHighlight.visible = false;
    this.buildAvatar();
    this.rebuildTerrain();
    this.rebuildStructures();
    this.rebuildParcel();
    this.resetCamera();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.bindEvents();
    this.animate();
  }

  localGround = (localX: number, localZ: number): number => {
    const height = heightAtM(this.state.center.x + localX, this.state.center.y - localZ, this.state.seed);
    return height < 0 ? 0 : height * RELIEF_SCALE;
  };

  update(next: WorldState): void {
    const old = this.state;
    this.state = next;
    const terrainSignature = `${next.seed}:${next.center.x.toFixed(2)}:${next.center.y.toFixed(2)}`;
    if (terrainSignature !== this.terrainSignature) {
      this.rebuildTerrain();
      this.rebuildParcel();
      this.resetCamera();
    }
    const structureSignature = next.structures.map((item) => `${item.id}:${item.type}:${item.gx}:${item.gy}:${item.level}`).join("|");
    if (structureSignature !== this.structureSignature) this.rebuildStructures();
    if (old.mode !== next.mode) this.applyMode();
  }

  setCallbacks(callbacks: WorldCallbacks): void {
    this.callbacks = callbacks;
  }

  setHoveredCell(cell: { x: number; y: number } | null): void {
    if (!cell || !this.state.parcel) {
      this.cellHighlight.visible = false;
      return;
    }
    const world = parcelCellToWorld(parcelCenter(this.state.parcel), cell.x, cell.y);
    const x = world.x - this.state.center.x;
    const z = this.state.center.y - world.y;
    const positions = this.cellHighlight.geometry.getAttribute("position") as THREE.BufferAttribute;
    const half = PARCEL_CELL_M * 0.47;
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
    for (let index = 0; index < 4; index += 1) {
      const a = corners[index];
      const b = corners[(index + 1) % 4];
      positions.setXYZ(index * 2, x + a[0], this.localGround(x + a[0], z + a[1]) + 4, z + a[1]);
      positions.setXYZ(index * 2 + 1, x + b[0], this.localGround(x + b[0], z + b[1]) + 4, z + b[1]);
    }
    positions.needsUpdate = true;
    this.cellHighlight.geometry.computeBoundingSphere();
    this.cellHighlight.visible = true;
  }

  private makeCellHighlight(): THREE.LineSegments {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#f5d794", transparent: true, opacity: 0.95, depthTest: false }));
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshBasicMaterial && material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
    }
  }

  private rebuildTerrain(): void {
    this.terrainSignature = `${this.state.seed}:${this.state.center.x.toFixed(2)}:${this.state.center.y.toFixed(2)}`;
    this.clearGroup(this.terrainGroup);
    this.clearGroup(this.rasterGroup);
    this.pickMeshes.length = 0;
    this.rasterMaterials.length = 0;
    this.baseMaterials.length = 0;
    if (this.water) {
      this.scene.remove(this.water);
      this.water.geometry.dispose();
      (this.water.material as THREE.Material).dispose();
    }
    const centerTile = worldToTile(this.state.center.x, this.state.center.y, TILE_ZOOM);
    let loaded = 0;
    const total = 9;
    this.callbacks.onTileStatus(0, total);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (centerTile.y + dy < 0 || centerTile.y + dy >= 2 ** TILE_ZOOM) continue;
        const tile = { z: TILE_ZOOM, x: (centerTile.x + dx + 2 ** TILE_ZOOM) % 2 ** TILE_ZOOM, y: centerTile.y + dy };
        const geometry = makeTerrainGeometry(tile, this.state.center, this.state.seed, this.localGround, true);
        const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.terrain = true;
        this.baseMaterials.push(material);
        this.pickMeshes.push(mesh);
        this.terrainGroup.add(mesh);

        const rasterGeometry = makeTerrainGeometry(tile, this.state.center, this.state.seed, this.localGround, false);
        const rasterMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
        const raster = new THREE.Mesh(rasterGeometry, rasterMaterial);
        raster.renderOrder = 3;
        this.rasterMaterials.push(rasterMaterial);
        this.rasterGroup.add(raster);
        new THREE.TextureLoader().load(
          `/api/tiles/${tile.z}/${tile.x}/${tile.y}.png`,
          (texture) => {
            if (this.disposed) { texture.dispose(); return; }
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            rasterMaterial.map = texture;
            rasterMaterial.needsUpdate = true;
            loaded += 1;
            this.callbacks.onTileStatus(loaded, total);
          },
          undefined,
          () => { loaded += 1; this.callbacks.onTileStatus(loaded, total); },
        );
      }
    }
    const span = tileSizeM(TILE_ZOOM) * 3;
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshBasicMaterial({ color: "#3d92ad", transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.35;
    this.water.renderOrder = 2;
    this.scene.add(this.water);
    this.applyMode();
  }

  private applyMode(): void {
    for (const material of this.rasterMaterials) {
      material.opacity = this.state.mode === "RASTER" ? 1 : 0.55;
      material.visible = this.state.mode !== "FLAT";
    }
    for (const material of this.baseMaterials) {
      material.transparent = this.state.mode === "RASTER";
      material.opacity = this.state.mode === "RASTER" ? 0 : 1;
      material.depthWrite = this.state.mode !== "RASTER";
      material.needsUpdate = true;
    }
  }

  private rebuildParcel(): void {
    this.clearGroup(this.parcelGroup);
    const parcel = this.state.parcel;
    if (!parcel) return;
    const points: THREE.Vector3[] = [];
    const corners = [
      { x: parcel.centerX - 3200, y: parcel.centerY + 3200 },
      { x: parcel.centerX + 3200, y: parcel.centerY + 3200 },
      { x: parcel.centerX + 3200, y: parcel.centerY - 3200 },
      { x: parcel.centerX - 3200, y: parcel.centerY - 3200 },
    ];
    for (let side = 0; side < 4; side += 1) {
      const a = corners[side];
      const b = corners[(side + 1) % 4];
      for (let step = 0; step <= 24; step += 1) {
        const t = step / 24;
        const worldX = THREE.MathUtils.lerp(a.x, b.x, t);
        const worldY = THREE.MathUtils.lerp(a.y, b.y, t);
        const x = worldX - this.state.center.x;
        const z = this.state.center.y - worldY;
        points.push(new THREE.Vector3(x, this.localGround(x, z) + 6, z));
      }
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: "#f2ce7c", transparent: true, opacity: 0.82 }));
    this.parcelGroup.add(line);
  }

  private rebuildStructures(): void {
    this.structureSignature = this.state.structures.map((item) => `${item.id}:${item.type}:${item.gx}:${item.gy}:${item.level}`).join("|");
    this.clearGroup(this.structureGroup);
    for (const structure of this.state.structures) {
      const parcel = this.state.parcel;
      if (!parcel) continue;
      const definition = getStructureDefinition(structure.type);
      const world = parcelCellToWorld(parcelCenter(parcel), structure.gx, structure.gy);
      const x = world.x - this.state.center.x;
      const z = this.state.center.y - world.y;
      const group = new THREE.Group();
      group.position.set(x, this.localGround(x, z), z);
      group.rotation.y = structure.rotation * Math.PI / 2;
      group.userData.structureId = structure.id;
      const material = new THREE.MeshBasicMaterial({ color: definition.color });
      const dark = new THREE.MeshBasicMaterial({ color: new THREE.Color(definition.color).multiplyScalar(0.55) });
      const height = definition.height * (1 + (structure.level - 1) * 0.2);
      let body: THREE.Mesh;
      if (["wind_turbine", "radar"].includes(structure.type)) {
        body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 5, height, 8), material);
        body.position.y = height / 2;
        const cross = new THREE.Mesh(new THREE.BoxGeometry(48, 2.5, 3), dark);
        cross.position.y = height * 0.85;
        cross.rotation.z = structure.type === "wind_turbine" ? 0.55 : 0;
        group.add(cross);
      } else if (["turret", "monument"].includes(structure.type)) {
        body = new THREE.Mesh(new THREE.CylinderGeometry(8, 13, height, structure.type === "turret" ? 8 : 4), material);
        body.position.y = height / 2;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(11, height * 0.35, 6), dark);
        cap.position.y = height * 1.08;
        group.add(cap);
      } else if (["solar_array", "rampart", "tidal_generator"].includes(structure.type)) {
        body = new THREE.Mesh(new THREE.BoxGeometry(62, Math.max(3, height), 38), material);
        body.position.y = Math.max(3, height) / 2;
        if (structure.type === "solar_array") body.rotation.z = -0.16;
      } else {
        body = new THREE.Mesh(new THREE.BoxGeometry(54, height, 54), material);
        body.position.y = height / 2;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(42, Math.min(18, height * 0.45), 4), dark);
        roof.position.y = height + Math.min(18, height * 0.45) / 2;
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
      }
      body.userData.structureId = structure.id;
      group.add(body);
      const ring = new THREE.Mesh(new THREE.RingGeometry(37, 40, 32), new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 1;
      ring.userData.structureId = structure.id;
      group.add(ring);
      this.structureGroup.add(group);
    }
  }

  private buildAvatar(): void {
    const body = new THREE.Mesh(new THREE.ConeGeometry(8, 24, 6), new THREE.MeshBasicMaterial({ color: "#f4d689" }));
    body.position.y = 12;
    const halo = new THREE.Mesh(new THREE.RingGeometry(13, 16, 24), new THREE.MeshBasicMaterial({ color: "#f4d689", transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthTest: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 2;
    this.avatar.add(body, halo);
    this.avatar.position.copy(this.avatarPosition);
  }

  private resetCamera(): void {
    this.avatarPosition.set(0, this.localGround(0, 0), 0);
    this.avatar.position.copy(this.avatarPosition);
    const ground = this.localGround(0, 0);
    this.camera.position.set(850, ground + 1250, 1450);
    this.controls.target.set(0, ground + 25, 0);
    this.controls.update();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private setPointer(event: PointerEvent): void {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private terrainIntersection(event: PointerEvent): THREE.Intersection | null {
    this.setPointer(event);
    return this.raycaster.intersectObjects(this.pickMeshes, false)[0] ?? null;
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => { this.pointerDown = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener("pointermove", (event) => {
      if (event.buttons) return;
      const hit = this.terrainIntersection(event);
      if (!hit || !this.state.parcel) { this.callbacks.onHoverCell(null); return; }
      const global = { x: this.state.center.x + hit.point.x, y: this.state.center.y - hit.point.z };
      const cell = worldToParcelCell(global, parcelCenter(this.state.parcel));
      this.callbacks.onHoverCell(cell);
    });
    canvas.addEventListener("pointerleave", () => this.callbacks.onHoverCell(null));
    canvas.addEventListener("pointerup", (event) => {
      if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 6) return;
      this.setPointer(event);
      const structureHits = this.raycaster.intersectObjects(this.structureGroup.children, true);
      const structureId = structureHits.find((hit) => hit.object.userData.structureId || hit.object.parent?.userData.structureId)?.object;
      if (structureId) {
        this.callbacks.onPickStructure(structureId.userData.structureId ?? structureId.parent?.userData.structureId);
        return;
      }
      const hit = this.terrainIntersection(event);
      if (!hit || !this.state.parcel) return;
      const global = { x: this.state.center.x + hit.point.x, y: this.state.center.y - hit.point.z };
      const cell = worldToParcelCell(global, parcelCenter(this.state.parcel));
      if (cell) {
        hit.point.y = this.localGround(hit.point.x, hit.point.z);
        this.callbacks.onPickCell(cell);
      }
    });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      this.keys.add(event.code);
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };

  private animate = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = Math.min(0.05, (now - this.previousTime) / 1000);
    this.previousTime = now;
    let dx = 0;
    let dz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) dz -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) dz += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) dx -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) dx += 1;
    if (dx || dz) {
      const length = Math.hypot(dx, dz);
      const speed = 185 * delta;
      this.avatarPosition.x = THREE.MathUtils.clamp(this.avatarPosition.x + dx / length * speed, -1750, 1750);
      this.avatarPosition.z = THREE.MathUtils.clamp(this.avatarPosition.z + dz / length * speed, -1750, 1750);
      this.avatarPosition.y = this.localGround(this.avatarPosition.x, this.avatarPosition.z);
      this.avatar.position.copy(this.avatarPosition);
      this.avatar.rotation.y = Math.atan2(dx, dz);
      const follow = new THREE.Vector3(this.avatarPosition.x, this.avatarPosition.y + 20, this.avatarPosition.z);
      const movement = follow.clone().sub(this.controls.target).multiplyScalar(0.045);
      this.controls.target.add(movement);
      this.camera.position.add(movement);
    }
    const cameraFloor = this.localGround(this.camera.position.x, this.camera.position.z) + 24;
    if (this.camera.position.y < cameraFloor) this.camera.position.y = cameraFloor;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.controls.dispose();
    this.clearGroup(this.terrainGroup);
    this.clearGroup(this.rasterGroup);
    this.clearGroup(this.structureGroup);
    this.clearGroup(this.parcelGroup);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function worldCenterFor(lon: number, lat: number): WorldPoint {
  return lonLatToWorld(lon, lat);
}
