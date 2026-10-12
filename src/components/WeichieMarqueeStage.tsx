/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture } from '../utils/textureGenerator';
import {
  getDirectImageUrl,
  getBackupDriveUrl,
  getUnsplashFallback,
  extractDriveFileId,
} from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface WeichieMarqueeStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
}

// Bends buffer geometry horizontally with radius R so outer edges wrap slightly toward camera (+Z)
function bendGeometryHorizontally(geo: THREE.BufferGeometry, radius: number, curveIntensity = 0.72): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const angle = vx / radius;
    const newX = radius * Math.sin(angle);
    // Concave wrap toward the camera: edges (+/- X) curve forward (+Z)
    const newZ = vz + radius * (1 - Math.cos(angle)) * curveIntensity;
    pos.setXYZ(i, newX, pos.getY(i), newZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createCurvedPlane(width: number, height: number, radius: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 32, 1);
  return bendGeometryHorizontally(geo, radius, 0.72);
}

function createCurvedBox(width: number, height: number, depth: number, radius: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth, 32, 1, 1);
  return bendGeometryHorizontally(geo, radius, 0.72);
}

// Soft stardust particle sprite texture with radial falloff
function createStardustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(235, 255, 220, 0.95)');
  grad.addColorStop(0.5, 'rgba(0, 210, 255, 0.45)');
  grad.addColorStop(0.8, 'rgba(255, 215, 0, 0.15)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Calculate uncropped heroic dimensions preserving the native aspect ratio
function computeHeroicDimensions(ratio: number): { w: number; h: number } {
  const clampedRatio = Math.max(0.42, Math.min(2.4, ratio));

  if (clampedRatio >= 1.25) {
    // Landscape photo: Expand horizontally with strong presence
    const h = Math.max(2.2, 3.8 / Math.sqrt(clampedRatio));
    const w = h * clampedRatio;
    return { w: Math.min(4.35, w), h: Math.min(3.2, h) };
  } else if (clampedRatio <= 0.8) {
    // Portrait photo: Heroic vertical height, zero cropping
    const w = Math.max(2.1, 2.85 * Math.sqrt(clampedRatio));
    const h = w / clampedRatio;
    return { w: Math.min(3.2, w), h: Math.min(4.1, h) };
  } else {
    // Square or soft ratio
    const size = 3.2;
    return {
      w: size * Math.sqrt(clampedRatio),
      h: size / Math.sqrt(clampedRatio),
    };
  }
}

export const WeichieMarqueeStage: React.FC<WeichieMarqueeStageProps> = ({
  album,
  isActive,
  onSelectItem,
  activeIndex,
  onActiveIndexChange,
  batchIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectItemRef = useRef(onSelectItem);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const prevBatchRef = useRef(batchIndex);

  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
    onActiveIndexChangeRef.current = onActiveIndexChange;
  }, [onSelectItem, onActiveIndexChange]);

  const animStateRef = useRef({
    scrollPos: activeIndex as number,
    velocity: 0,
    isDragging: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    isHoveredOverStage: false,
    hoverFactor: 1.0,
    hoveredSlot: -1,
    mousePos: new THREE.Vector2(0, 0),
    programmaticTarget: null as number | null,
  });

  // When parent batchIndex changes, smoothly spring to batch
  useEffect(() => {
    if (prevBatchRef.current !== batchIndex) {
      prevBatchRef.current = batchIndex;
      animStateRef.current.programmaticTarget = batchIndex * 6;
      animStateRef.current.velocity = 0;
    }
  }, [batchIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    const items = album.items || [];
    const totalItems = items.length;
    if (totalItems === 0) return;

    // --- 1. THREE.JS SCENE & PERSPECTIVE CAMERA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000208, 0.022);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Camera centered at (0, 0, Z) with heroic framing distance
    camera.position.set(0, 0, isPortrait ? 9.8 : 8.2);
    camera.lookAt(0, 0, 0);

    // --- 2. WEICHIE-GRADE TONE MAPPING & RENDERER ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- 3. ATMOSPHERIC LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    // Center Top Key Spotlight
    const topSpotLight = new THREE.SpotLight(0xffffff, 6.5, 26, Math.PI / 4.0, 0.55, 1.2);
    topSpotLight.position.set(0, 6.0, 3.6);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Front fill light
    const frontKey = new THREE.DirectionalLight(0xffffff, 1.6);
    frontKey.position.set(0, 2.5, 6.5);
    scene.add(frontKey);

    // Atmospheric Rim Lights (Electric Cyan & Royal Blue)
    const leftRimLight = new THREE.PointLight(0x00d2ff, 4.0, 24);
    leftRimLight.position.set(-6.2, 1.8, 2.4);
    scene.add(leftRimLight);

    const rightRimLight = new THREE.PointLight(0x3b82f6, 4.0, 24);
    rightRimLight.position.set(6.2, 1.8, 2.4);
    scene.add(rightRimLight);

    // Mouse-reactive specular glow point in space
    const mouseReactiveLight = new THREE.PointLight(0x00d2ff, 3.2, 20);
    mouseReactiveLight.position.set(0, 0, 4.0);
    scene.add(mouseReactiveLight);

    // --- 4. MESH3D ORGANIC WAVY PARTICLE TERRAIN BACKGROUND ---
    const GRID_X = 105;
    const GRID_Z = 105;
    const TOTAL_TERRAIN_POINTS = GRID_X * GRID_Z;

    const terrainGeo = new THREE.BufferGeometry();
    const terrainPositions = new Float32Array(TOTAL_TERRAIN_POINTS * 3);
    const baseTerrainPositions = new Float32Array(TOTAL_TERRAIN_POINTS * 3);
    const terrainColors = new Float32Array(TOTAL_TERRAIN_POINTS * 3);

    let tIndex = 0;
    for (let i = 0; i < GRID_X; i++) {
      for (let j = 0; j < GRID_Z; j++) {
        const u = i / (GRID_X - 1);
        const v = j / (GRID_Z - 1);

        // Broad liquid horizon extending behind the carousel
        const tx = (u - 0.5) * 56;
        const tz = (v - 0.5) * 44 - 10;
        const ty = -2.2;

        terrainPositions[tIndex * 3] = tx;
        terrainPositions[tIndex * 3 + 1] = ty;
        terrainPositions[tIndex * 3 + 2] = tz;

        baseTerrainPositions[tIndex * 3] = tx;
        baseTerrainPositions[tIndex * 3 + 1] = ty;
        baseTerrainPositions[tIndex * 3 + 2] = tz;

        // Tri-color chromatic blend: Gold (#FFD700) -> Lime (#84CC16) -> Electric Cyan (#00D2FF)
        const colorT = (Math.sin(u * Math.PI * 2.5) + Math.cos(v * Math.PI * 2.0) + 2) / 4;
        let cr = 0, cg = 0, cb = 0;
        if (colorT < 0.5) {
          const f = colorT * 2;
          cr = 0.52 * f;
          cg = 0.85 * (1 - f) + 0.90 * f;
          cb = 1.0 * (1 - f) + 0.12 * f;
        } else {
          const f = (colorT - 0.5) * 2;
          cr = 0.52 * (1 - f) + 1.0 * f;
          cg = 0.90 * (1 - f) + 0.84 * f;
          cb = 0.12 * (1 - f) + 0.18 * f;
        }

        terrainColors[tIndex * 3] = cr;
        terrainColors[tIndex * 3 + 1] = cg;
        terrainColors[tIndex * 3 + 2] = cb;

        tIndex++;
      }
    }

    terrainGeo.setAttribute('position', new THREE.BufferAttribute(terrainPositions, 3));
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));

    const stardustTexture = createStardustTexture();
    const terrainMat = new THREE.PointsMaterial({
      size: 0.17,
      map: stardustTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const terrainMesh = new THREE.Points(terrainGeo, terrainMat);
    terrainMesh.renderOrder = 0;
    scene.add(terrainMesh);

    // --- 5. RECYCLING MESH POOL (EXACTLY 9 MESHES FOR FULL VIEWPORT COVERAGE) ---
    const POOL_SIZE = 9;
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Base template dimensions (aspect-aware scaling dynamically applies to these)
    const baseWidth = 2.6;
    const baseHeight = 3.6;
    const cardDepth = 0.08;
    const cardCurveRadius = 7.0;

    const photoWidth = baseWidth - 0.12;
    const photoHeight = baseHeight - 0.12;

    // Shared Base Geometries
    const chassisGeo = createCurvedBox(baseWidth, baseHeight, cardDepth, cardCurveRadius);
    const frameTrimGeo = createCurvedPlane(baseWidth, baseHeight, cardCurveRadius);
    const photoGeo = createCurvedPlane(photoWidth, photoHeight, cardCurveRadius);
    const backplateGeo = createCurvedPlane(baseWidth - 0.02, baseHeight - 0.02, cardCurveRadius);

    // Shared Materials
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0d16,
      metalness: 0.95,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });

    const glossyFrameTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef4ff,
      metalness: 0.98,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.95,
    });

    const backplateMat = new THREE.MeshStandardMaterial({
      color: 0x04060b,
      metalness: 0.95,
      roughness: 0.35,
    });

    // --- TEXTURE LOADER & BULLETPROOF MULTI-TIER CACHE ---
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const textureCache = new Map<number, THREE.Texture>();
    const textureRatios = new Map<number, number>();
    const loadingIndices = new Set<number>();
    const fallbackCanvasTextures = new Map<number, THREE.CanvasTexture>();

    const getProceduralTexture = (photoIdx: number): THREE.CanvasTexture => {
      let fb = fallbackCanvasTextures.get(photoIdx);
      if (!fb) {
        const item = items[photoIdx];
        fb = createProceduralFrameTexture({
          title: item?.title || `Bandhobis ${photoIdx + 1}`,
          category: album.name,
          index: photoIdx,
          total: totalItems,
        });
        fallbackCanvasTextures.set(photoIdx, fb);
      }
      return fb;
    };

    // Helper: Exact rendered width of any card based on its native aspect ratio
    const getCardRenderedWidth = (pIdx: number): number => {
      const ratio = textureRatios.get(pIdx) || 0.72;
      const { w } = computeHeroicDimensions(ratio);
      return w;
    };

    // Apply aspect-ratio aware scaling to a pool mesh group
    const applyAspectDimensions = (meshGroup: THREE.Group, photoIdx: number) => {
      const ratio = textureRatios.get(photoIdx) || 0.72;
      const { w, h } = computeHeroicDimensions(ratio);
      const sx = w / baseWidth;
      const sy = h / baseHeight;

      const chassisMesh = meshGroup.userData.chassisMesh as THREE.Mesh;
      const borderMesh = meshGroup.userData.borderMesh as THREE.Mesh;
      const photoMesh = meshGroup.userData.photoMesh as THREE.Mesh;
      const backMesh = meshGroup.userData.backMesh as THREE.Mesh;

      if (chassisMesh) chassisMesh.scale.set(sx, sy, 1);
      if (borderMesh) borderMesh.scale.set(sx, sy, 1);
      if (photoMesh) photoMesh.scale.set(sx, sy, 1);
      if (backMesh) backMesh.scale.set(sx, sy, 1);
    };

    const bindTextureToMesh = (photoIdx: number, tex: THREE.Texture) => {
      poolMeshes.forEach((meshGroup) => {
        if (meshGroup.userData.photoIndex === photoIdx) {
          const photoMesh = meshGroup.userData.photoMesh as THREE.Mesh;
          const mat = photoMesh.material as THREE.MeshBasicMaterial;
          mat.map = tex;
          mat.needsUpdate = true;
          applyAspectDimensions(meshGroup, photoIdx);
        }
      });
    };

    const recordAspectRatio = (photoIdx: number, tex: THREE.Texture) => {
      const img = tex.image as HTMLImageElement;
      if (img && img.naturalWidth && img.naturalHeight) {
        textureRatios.set(photoIdx, img.naturalWidth / img.naturalHeight);
      } else if (img && img.width && img.height) {
        textureRatios.set(photoIdx, img.width / img.height);
      } else {
        textureRatios.set(photoIdx, 0.72);
      }
    };

    const loadTextureForIndex = (photoIdx: number) => {
      if (textureCache.has(photoIdx) || loadingIndices.has(photoIdx)) return;
      const item = items[photoIdx];
      if (!item) return;

      loadingIndices.add(photoIdx);

      const primaryUrl = getDirectImageUrl(item, photoIdx);
      const fileId = extractDriveFileId(item.id, item.url, item.thumbnail);
      const backupUrl = fileId ? getBackupDriveUrl(fileId) : primaryUrl;
      const unsplashUrl = getUnsplashFallback(photoIdx);

      // Tier 1: High-res direct raw stream
      textureLoader.load(
        primaryUrl,
        (loadedTex) => {
          loadingIndices.delete(photoIdx);
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
          loadedTex.magFilter = THREE.LinearFilter;
          loadedTex.needsUpdate = true;
          recordAspectRatio(photoIdx, loadedTex);
          textureCache.set(photoIdx, loadedTex);
          bindTextureToMesh(photoIdx, loadedTex);
        },
        undefined,
        () => {
          // Tier 2: Backup Google Drive direct stream
          textureLoader.load(
            backupUrl,
            (loadedTex) => {
              loadingIndices.delete(photoIdx);
              loadedTex.colorSpace = THREE.SRGBColorSpace;
              loadedTex.generateMipmaps = true;
              loadedTex.needsUpdate = true;
              recordAspectRatio(photoIdx, loadedTex);
              textureCache.set(photoIdx, loadedTex);
              bindTextureToMesh(photoIdx, loadedTex);
            },
            undefined,
            () => {
              // Tier 3: Curated Unsplash portrait fallback
              textureLoader.load(
                unsplashUrl,
                (loadedTex) => {
                  loadingIndices.delete(photoIdx);
                  loadedTex.colorSpace = THREE.SRGBColorSpace;
                  loadedTex.generateMipmaps = true;
                  loadedTex.needsUpdate = true;
                  recordAspectRatio(photoIdx, loadedTex);
                  textureCache.set(photoIdx, loadedTex);
                  bindTextureToMesh(photoIdx, loadedTex);
                },
                undefined,
                () => {
                  loadingIndices.delete(photoIdx);
                }
              );
            }
          );
        }
      );
    };

    // Instantiate exactly 9 mesh groups
    const poolMeshes: THREE.Group[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const group = new THREE.Group();
      group.userData = {
        poolId: i,
        virtualSlot: null as number | null,
        photoIndex: -1,
        item: null as StageMediaItem | null,
      };

      // 1. Dark metallic obsidian chassis
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      group.add(chassisMesh);
      group.userData.chassisMesh = chassisMesh;

      // 2. Glossy metallic framing border
      const borderMesh = new THREE.Mesh(frameTrimGeo, glossyFrameTrimMat);
      borderMesh.position.z = cardDepth / 2 + 0.002;
      group.add(borderMesh);
      group.userData.borderMesh = borderMesh;

      // 3. FRONT FACE PHOTO PLANE
      const initialTex = getProceduralTexture(i % totalItems);
      const photoMat = new THREE.MeshBasicMaterial({
        map: initialTex,
        color: 0xffffff,
        side: THREE.FrontSide,
        toneMapped: true,
      });
      const photoMesh = new THREE.Mesh(photoGeo, photoMat);
      photoMesh.position.z = cardDepth / 2 + 0.006;
      photoMesh.renderOrder = 2;
      group.add(photoMesh);
      group.userData.photoMesh = photoMesh;

      // 4. Obsidian backplate
      const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
      backMesh.position.z = -cardDepth / 2 - 0.002;
      backMesh.rotation.y = Math.PI;
      group.add(backMesh);
      group.userData.backMesh = backMesh;

      rootGroup.add(group);
      poolMeshes.push(group);
    }

    // --- 6. INTERACTION & RAYCASTING ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let isPointerDown = false;
    let didDragSignificantly = false;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      didDragSignificantly = false;
      animStateRef.current.isDragging = true;
      animStateRef.current.startX = e.clientX;
      animStateRef.current.lastX = e.clientX;
      animStateRef.current.lastTime = performance.now();
      animStateRef.current.velocity = 0;
      animStateRef.current.programmaticTarget = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      animStateRef.current.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
      animStateRef.current.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;

      pointer.x = animStateRef.current.mousePos.x;
      pointer.y = animStateRef.current.mousePos.y;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(rootGroup.children, true);

      if (intersects.length > 0) {
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && hit.userData?.poolId === undefined) {
          hit = hit.parent;
        }
        if (hit && hit.userData) {
          animStateRef.current.hoveredSlot = hit.userData.poolId;
        }
      } else {
        animStateRef.current.hoveredSlot = -1;
      }

      if (!isPointerDown) return;

      const deltaX = e.clientX - animStateRef.current.lastX;
      if (Math.abs(e.clientX - animStateRef.current.startX) > 7) {
        didDragSignificantly = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - animStateRef.current.lastTime);

      const sensitivity = 2.4 / window.innerWidth;
      const indexDelta = -deltaX * sensitivity;

      animStateRef.current.scrollPos += indexDelta;
      animStateRef.current.velocity = (indexDelta / dt) * 16;
      animStateRef.current.lastX = e.clientX;
      animStateRef.current.lastTime = now;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      animStateRef.current.isDragging = false;

      // Lightbox click on card when no drag occurred
      if (!didDragSignificantly) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(rootGroup.children, true);

        if (intersects.length > 0) {
          let hitGroup: THREE.Object3D | null = intersects[0].object;
          while (hitGroup && !hitGroup.userData?.item) {
            hitGroup = hitGroup.parent;
          }

          if (hitGroup && hitGroup.userData?.item) {
            onSelectItemRef.current(hitGroup.userData.item);
          }
        }
      }
    };

    const onPointerEnter = () => {
      animStateRef.current.isHoveredOverStage = true;
    };

    const onPointerLeave = () => {
      animStateRef.current.isHoveredOverStage = false;
      animStateRef.current.hoveredSlot = -1;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        animStateRef.current.velocity += e.deltaX * 0.0006;
        animStateRef.current.programmaticTarget = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        animStateRef.current.velocity -= 0.038;
        animStateRef.current.programmaticTarget = null;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        animStateRef.current.velocity += 0.038;
        animStateRef.current.programmaticTarget = null;
      }
    };

    const onResize = () => {
      const portraitNow = window.innerWidth < 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = portraitNow ? 9.8 : 8.2;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointerenter', onPointerEnter);
    dom.addEventListener('pointerleave', onPointerLeave);
    dom.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    // --- 7. DYNAMIC BOUNDING-BOX ARC POSITIONING & ANIMATION LOOP ---
    let animationFrameId: number;
    let lastNotifiedIndex = -1;
    let frameCounter = 0;
    const clock = new THREE.Clock();
    const baseDriftSpeed = 0.0034;
    const globalArcRadius = 8.2;
    const MANDATORY_BUFFER_GAP = 0.55;

    // Helper: Calculate distance step between center of slot j and slot j + 1
    const getSlotStepDistance = (slot: number): number => {
      const p1 = ((slot % totalItems) + totalItems) % totalItems;
      const p2 = (((slot + 1) % totalItems) + totalItems) % totalItems;
      const w1 = getCardRenderedWidth(p1);
      const w2 = getCardRenderedWidth(p2);
      return (w1 + w2) * 0.5 + MANDATORY_BUFFER_GAP;
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      frameCounter++;

      const state = animStateRef.current;
      const elapsed = clock.getElapsedTime();

      // Mouse reactive atmospheric ambient lighting
      mouseReactiveLight.position.x += (state.mousePos.x * 5.2 - mouseReactiveLight.position.x) * 0.08;
      mouseReactiveLight.position.y += (state.mousePos.y * 3.6 - mouseReactiveLight.position.y) * 0.08;

      // Update Mesh3D organic wavy particle terrain displacement
      const terrainPosAttr = terrainGeo.attributes.position;
      for (let i = 0; i < TOTAL_TERRAIN_POINTS; i++) {
        const bx = baseTerrainPositions[i * 3];
        const bz = baseTerrainPositions[i * 3 + 2];

        // Complex undulating liquid stardust waves
        const wave1 = Math.sin(bx * 0.15 + elapsed * 0.9) * Math.cos(bz * 0.16 + elapsed * 0.75) * 1.35;
        const wave2 = Math.sin((bx + bz) * 0.10 + elapsed * 1.1) * 0.8;
        const wave3 = Math.cos(Math.sqrt(bx * bx + bz * bz) * 0.20 - elapsed * 1.25) * 0.5;

        terrainPosAttr.setY(i, -2.2 + wave1 + wave2 + wave3);
      }
      terrainPosAttr.needsUpdate = true;

      // Gentle mouse parallax on the terrain
      terrainMesh.rotation.y = state.mousePos.x * 0.045;
      terrainMesh.rotation.x = -0.16 + state.mousePos.y * 0.035;

      // Smooth hover pause factor
      const targetHover = state.isHoveredOverStage ? 0.0 : 1.0;
      state.hoverFactor += (targetHover - state.hoverFactor) * 0.07;

      // Physics: Programmatic spring target OR Inertia & Auto-drift
      if (state.programmaticTarget !== null) {
        state.scrollPos += (state.programmaticTarget - state.scrollPos) * 0.12;
        if (Math.abs(state.programmaticTarget - state.scrollPos) < 0.002) {
          state.scrollPos = state.programmaticTarget;
          state.programmaticTarget = null;
        }
      } else if (state.isDragging) {
        // Drag position updated directly in onPointerMove
      } else {
        state.scrollPos += state.velocity;
        state.velocity *= 0.92;

        if (Math.abs(state.velocity) < 0.0004) {
          state.velocity = 0;
          state.scrollPos += baseDriftSpeed * state.hoverFactor;
        }
      }

      // Dynamic Bounding-box Arc Positioning
      const kRef = Math.floor(state.scrollPos);
      const frac = state.scrollPos - kRef;
      const stepRef = getSlotStepDistance(kRef);
      const focusArc = frac * stepRef;

      const arcDistances: { [k: number]: number } = {};
      arcDistances[kRef] = 0;

      for (let k = kRef + 1; k <= kRef + 4; k++) {
        arcDistances[k] = arcDistances[k - 1] + getSlotStepDistance(k - 1);
      }
      for (let k = kRef - 1; k >= kRef - 4; k--) {
        arcDistances[k] = arcDistances[k + 1] - getSlotStepDistance(k);
      }

      // Render the 9 visible slots centered around kRef
      for (let k = kRef - 4; k <= kRef + 4; k++) {
        const poolIndex = ((k % POOL_SIZE) + POOL_SIZE) % POOL_SIZE;
        const meshGroup = poolMeshes[poolIndex];

        const photoIndex = ((k % totalItems) + totalItems) % totalItems;
        const item = items[photoIndex];

        // Recycle texture and apply dynamic aspect-ratio dimensions
        if (meshGroup.userData.photoIndex !== photoIndex) {
          meshGroup.userData.photoIndex = photoIndex;
          meshGroup.userData.item = item;
          meshGroup.userData.virtualSlot = k;

          const photoMesh = meshGroup.userData.photoMesh as THREE.Mesh;
          const photoMat = photoMesh.material as THREE.MeshBasicMaterial;

          if (textureCache.has(photoIndex)) {
            photoMat.map = textureCache.get(photoIndex)!;
            photoMat.needsUpdate = true;
          } else {
            photoMat.map = getProceduralTexture(photoIndex);
            photoMat.needsUpdate = true;
            loadTextureForIndex(photoIndex);
          }

          applyAspectDimensions(meshGroup, photoIndex);
        }

        // Relative arc distance along the cylindrical curve
        const arcPos = (arcDistances[k] ?? 0) - focusArc;
        const theta = arcPos / globalArcRadius;
        const x = globalArcRadius * Math.sin(theta);
        const z = globalArcRadius * (Math.cos(theta) - 1);

        const isHovered = meshGroup.userData.poolId === state.hoveredSlot;
        const hoverZLift = isHovered ? 0.35 : 0;
        const hoverTiltX = isHovered ? -state.mousePos.y * 0.12 : 0;
        const hoverTiltY = isHovered ? state.mousePos.x * 0.12 : 0;

        meshGroup.position.set(x, 0, z + hoverZLift);
        meshGroup.rotation.set(hoverTiltX, theta * 0.88 + hoverTiltY, 0);

        // Center card gets maximum scale and clarity; edges softly recede
        const scaleBoost = Math.max(0, Math.cos(theta));
        const baseScale = 0.90 + 0.32 * Math.pow(scaleBoost, 2.8);
        const finalScale = isHovered ? baseScale * 1.08 : baseScale;
        meshGroup.scale.set(finalScale, finalScale, finalScale);
      }

      // Offscreen Texture Pruning
      if (frameCounter % 25 === 0) {
        const activeIndices = new Set<number>();
        for (let k = kRef - 4; k <= kRef + 4; k++) {
          const idx = ((k % totalItems) + totalItems) % totalItems;
          activeIndices.add(idx);
        }

        textureCache.forEach((tex, idx) => {
          if (!activeIndices.has(idx)) {
            tex.dispose();
            textureCache.delete(idx);
          }
        });
      }

      // Notify parent of center item changes
      const currentCenterPhotoIdx = ((Math.round(state.scrollPos) % totalItems) + totalItems) % totalItems;
      if (currentCenterPhotoIdx !== lastNotifiedIndex) {
        lastNotifiedIndex = currentCenterPhotoIdx;
        onActiveIndexChangeRef.current(currentCenterPhotoIdx);
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- 8. CLEANUP & MEMORY DISPOSAL ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerenter', onPointerEnter);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);

      textureCache.forEach((tex) => tex.dispose());
      textureCache.clear();
      fallbackCanvasTextures.forEach((tex) => tex.dispose());
      fallbackCanvasTextures.clear();

      terrainGeo.dispose();
      terrainMat.dispose();
      stardustTexture.dispose();

      chassisGeo.dispose();
      frameTrimGeo.dispose();
      photoGeo.dispose();
      backplateGeo.dispose();
      chassisMat.dispose();
      glossyFrameTrimMat.dispose();
      backplateMat.dispose();

      rootGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (dom && dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
    };
  }, [isActive, album]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0"
    />
  );
};
