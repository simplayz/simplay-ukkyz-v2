import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getStructureDefinition } from "@/engine/catalogue";
import { PARCEL_GRID_SIZE } from "@/engine/geodesy";
import { getRoomDefinition } from "@/engine/rooms";
import { BIOMES } from "@/engine/terrain";
import type { BuildingDTO, ParcelDTO, StructureDTO } from "@/lib/types";

const biomeColors: Record<string, string> = {
  deep_sea: "#194e67", sea: "#32768b", lake: "#4b91a4", coast: "#96998d", wetland: "#527c69",
  urban: "#85857e", desert: "#a39b7f", alpine: "#9ca09c", tundra: "#7e8b82", boreal_forest: "#355c49",
  rainforest: "#285c42", temperate_forest: "#48734f", savanna: "#7f9458", grassland: "#68875c",
};

export class PlanRenderer {
  private readonly container: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resizeObserver: ResizeObserver;
  private readonly pickMeshes: THREE.Object3D[] = [];
  private readonly onSelect: (id: string) => void;
  private frame = 0;
  private disposed = false;
  private mode: "area" | "building" | null = null;

  constructor(container: HTMLElement, onSelect: (id: string) => void) {
    this.container = container;
    this.onSelect = onSelect;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#0c1617", 0.35);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D plan preview. Drag to orbit and scroll to zoom.");
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog("#101b1d", 110, 240);
    this.scene.add(this.content);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 180;
    this.renderer.domElement.addEventListener("pointerup", this.pick);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private clear(): void {
    for (const child of [...this.content.children]) {
      this.content.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
    this.pickMeshes.length = 0;
  }

  private cameraFor(mode: "area" | "building"): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === "area") {
      this.camera.position.set(48, 59, 64);
      this.controls.target.set(0, 2, 0);
    } else {
      this.camera.position.set(15, 18, 18);
      this.controls.target.set(0, 1, 0);
    }
    this.controls.update();
  }

  setArea(parcel: ParcelDTO, buildings: BuildingDTO[], structures: StructureDTO[], selectedId: string | null): void {
    this.clear();
    this.cameraFor("area");
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const size = PARCEL_GRID_SIZE;
    for (let y = 0; y <= size; y += 1) {
      for (let x = 0; x <= size; x += 1) {
        const cell = parcel.cells[Math.min(y, size - 1) * size + Math.min(x, size - 1)];
        const elevation = Math.max(0, cell.h) * 0.018;
        positions.push(x - size / 2, elevation, y - size / 2);
        const color = new THREE.Color(biomeColors[BIOMES[cell.b]] ?? "#66805b");
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const a = y * (size + 1) + x;
        const b = a + 1;
        const c = a + size + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const ground = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.content.add(ground);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: "#4c96a8", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.05;
    this.content.add(water);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.15, size)), new THREE.LineBasicMaterial({ color: "#d6c379", transparent: true, opacity: 0.55 }));
    this.content.add(border);

    for (const structure of structures) {
      if (buildings.some((building) => building.structureId === structure.id)) continue;
      const cell = parcel.cells[structure.gy * size + structure.gx];
      const definition = getStructureDefinition(structure.type);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, Math.max(0.4, definition.height * 0.055), 0.65), new THREE.MeshBasicMaterial({ color: definition.color }));
      mesh.position.set(structure.gx + 0.5 - size / 2, Math.max(0, cell.h) * 0.018 + mesh.geometry.parameters.height / 2, structure.gy + 0.5 - size / 2);
      this.content.add(mesh);
    }

    for (const building of buildings) {
      const definition = getStructureDefinition(building.archetype);
      const cell = parcel.cells[building.gy * size + building.gx];
      const base = Math.max(0, cell.h) * 0.018;
      const height = Math.max(1.2, definition.height * 0.12);
      const group = new THREE.Group();
      group.position.set(building.gx + building.width / 2 - size / 2, base, building.gy + building.depth / 2 - size / 2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(building.width * 0.86, height, building.depth * 0.86), new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.88 }));
      body.position.y = height / 2;
      body.userData.selectId = building.id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: selectedId === building.id ? "#fff0ad" : "#18221f" }));
      edges.position.copy(body.position);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(building.width * 0.68, Math.min(1.5, height * 0.4), 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(definition.color).multiplyScalar(0.65) }));
      roof.position.y = height + Math.min(1.5, height * 0.4) / 2;
      roof.rotation.y = Math.PI / 4;
      roof.userData.selectId = building.id;
      group.add(body, edges, roof);
      this.content.add(group);
      this.pickMeshes.push(body, roof);
    }
  }

  setBuilding(building: BuildingDTO, selectedRoomId: string | null): void {
    this.clear();
    this.cameraFor("building");
    const gridSize = 12;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(gridSize, 0.25, gridSize), new THREE.MeshBasicMaterial({ color: "#26332f" }));
    floor.position.y = -0.15;
    this.content.add(floor);
    const grid = new THREE.GridHelper(gridSize, gridSize, "#6d786e", "#3c4c45");
    grid.position.y = 0.01;
    this.content.add(grid);
    for (const room of building.rooms) {
      const definition = getRoomDefinition(room.kind);
      const height = definition.height * 0.65;
      const geometry = new THREE.BoxGeometry(room.width * 0.94, height, room.depth * 0.94);
      const material = new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: selectedRoomId === room.id ? 0.96 : 0.69, depthWrite: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(room.x + room.width / 2 - gridSize / 2, height / 2, room.y + room.depth / 2 - gridSize / 2);
      mesh.userData.selectId = room.id;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: selectedRoomId === room.id ? "#fff1a8" : "#24322e" }));
      edges.position.copy(mesh.position);
      this.content.add(mesh, edges);
      this.pickMeshes.push(mesh);
      const roofLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 0.04, room.depth)), new THREE.LineBasicMaterial({ color: definition.color }));
      roofLine.position.set(mesh.position.x, height + 0.15, mesh.position.z);
      this.content.add(roofLine);
    }
  }

  private pick = (event: PointerEvent): void => {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickMeshes, false)[0];
    if (hit?.object.userData.selectId) this.onSelect(hit.object.userData.selectId as string);
  };

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerup", this.pick);
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
