/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture } from '../utils/textureGenerator';
import type { AlbumData, StageMediaItem } from '../types';

interface WeichieMarqueeStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
}

// Bends buffer geometry horizontally with radius R so edges wrap slightly toward camera (+Z)
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

  // When parent batchIndex changes (e.g. user clicked bottom batch navigation), smoothly spring to batch
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
    scene.fog = new THREE.FogExp2(0x000208, 0.028);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Camera is optically centered at (0, 0, Z)
    camera.position.set(0, 0, isPortrait ? 9.2 : 7.8);
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
    renderer.toneMappingExposure = 1.38;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- 3. ATMOSPHERIC LIGHTING & SPECULAR SHINE ---
    const ambientLight = new THREE.AmbientLight(0x1a2238, 2.0);
    scene.add(ambientLight);

    // Center Top Key Spotlight
    const topSpotLight = new THREE.SpotLight(0xffffff, 6.8, 26, Math.PI / 4.0, 0.52, 1.2);
    topSpotLight.position.set(0, 5.8, 3.4);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Front fill light
    const frontKey = new THREE.DirectionalLight(0xffffff, 1.8);
    frontKey.position.set(0, 2.8, 6.2);
    scene.add(frontKey);

    // Dual Atmospheric Rim Lights (Electric Cyan & Royal Blue)
    const leftRimLight = new THREE.PointLight(0x00d2ff, 4.0, 22);
    leftRimLight.position.set(-5.8, 1.6, 2.2);
    scene.add(leftRimLight);

    const rightRimLight = new THREE.PointLight(0x3b82f6, 4.0, 22);
    rightRimLight.position.set(5.8, 1.6, 2.2);
    scene.add(rightRimLight);

    // Mouse-reactive specular glow point in space
    const mouseReactiveLight = new THREE.PointLight(0x00d2ff, 3.0, 18);
    mouseReactiveLight.position.set(0, 0, 3.8);
    scene.add(mouseReactiveLight);

    // --- 4. RECYCLING MESH POOL (EXACTLY 7 MESHES) ---
    // Zero tab freezing, constant ~25MB GPU memory footprint
    const POOL_SIZE = 7;
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const cardWidth = 2.25;
    const cardHeight = 3.25;
    const cardDepth = 0.08;
    const cardCurveRadius = 6.8;

    const photoWidth = cardWidth - 0.14;
    const photoHeight = cardHeight - 0.14;

    // Shared Geometries (curved cylindrical panels)
    const chassisGeo = createCurvedBox(cardWidth, cardHeight, cardDepth, cardCurveRadius);
    const borderGeo = createCurvedBox(cardWidth + 0.03, cardHeight + 0.03, 0.024, cardCurveRadius);
    const photoGeo = createCurvedPlane(photoWidth, photoHeight, cardCurveRadius);
    const backplateGeo = createCurvedPlane(cardWidth - 0.02, cardHeight - 0.02, cardCurveRadius);

    // Shared Materials
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x090c14,
      metalness: 0.94,
      roughness: 0.28,
    });

    const glossyMetallicBorderMat = new THREE.MeshPhysicalMaterial({
      color: 0xf5f8ff,
      metalness: 0.96,
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

    // Texture Cache & Async Loader
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const textureCache = new Map<number, THREE.Texture>();
    const loadingIndices = new Set<number>();
    const fallbackTextures = new Map<number, THREE.CanvasTexture>();

    const getFallbackTexture = (photoIdx: number): THREE.CanvasTexture => {
      let fb = fallbackTextures.get(photoIdx);
      if (!fb) {
        const item = items[photoIdx];
        fb = createProceduralFrameTexture({
          title: item?.title || `Bandhobis ${photoIdx + 1}`,
          category: album.name,
          index: photoIdx,
          total: totalItems,
        });
        fallbackTextures.set(photoIdx, fb);
      }
      return fb;
    };

    const loadTextureForIndex = (photoIdx: number) => {
      if (textureCache.has(photoIdx) || loadingIndices.has(photoIdx)) return;
      const item = items[photoIdx];
      if (!item || !item.thumbnail) return;

      loadingIndices.add(photoIdx);
      textureLoader.load(
        item.thumbnail,
        (loadedTex) => {
          loadingIndices.delete(photoIdx);
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          textureCache.set(photoIdx, loadedTex);

          // Update any active pool mesh currently displaying photoIdx
          poolMeshes.forEach((meshGroup) => {
            if (meshGroup.userData.photoIndex === photoIdx) {
              const photoMesh = meshGroup.userData.photoMesh as THREE.Mesh;
              (photoMesh.material as THREE.MeshStandardMaterial).map = loadedTex;
              (photoMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
            }
          });
        },
        undefined,
        () => {
          loadingIndices.delete(photoIdx);
        }
      );
    };

    // Instantiate exactly 7 mesh groups
    const poolMeshes: THREE.Group[] = [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const group = new THREE.Group();
      group.userData = {
        poolId: i,
        virtualSlot: null as number | null,
        photoIndex: -1,
        item: null as StageMediaItem | null,
      };

      // 1. Dark obsidian chassis
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      group.add(chassisMesh);

      // 2. High-gloss metallic border with bevel highlight
      const borderMesh = new THREE.Mesh(borderGeo, glossyMetallicBorderMat);
      borderMesh.position.z = cardDepth / 2 + 0.008;
      group.add(borderMesh);

      // 3. Photo plane with curved surface
      const photoMat = new THREE.MeshStandardMaterial({
        map: getFallbackTexture(i % totalItems),
        metalness: 0.06,
        roughness: 0.22,
        side: THREE.FrontSide,
      });
      const photoMesh = new THREE.Mesh(photoGeo, photoMat);
      photoMesh.position.z = cardDepth / 2 + 0.016;
      group.add(photoMesh);
      group.userData.photoMesh = photoMesh;

      // 4. Matte obsidian backplate
      const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
      backMesh.position.z = -cardDepth / 2 - 0.002;
      backMesh.rotation.y = Math.PI;
      group.add(backMesh);

      rootGroup.add(group);
      poolMeshes.push(group);
    }

    // --- 5. INTERACTION & RAYCASTING ---
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

      // Raycast for hover focus on 3D cards
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

      // Kinetic dragging
      const sensitivity = 2.8 / window.innerWidth;
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
      // Horizontal mouse wheel or trackpad swipe
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
      camera.position.z = portraitNow ? 9.2 : 7.8;
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

    // --- 6. 60+ FPS VIRTUALIZED MARQUEE ANIMATION LOOP ---
    let animationFrameId: number;
    let lastNotifiedIndex = -1;
    let frameCounter = 0;
    const baseDriftSpeed = 0.0034; // Luxury slow drift speed
    const globalArcRadius = 7.2;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      frameCounter++;

      const state = animStateRef.current;

      // Mouse reactive atmospheric ambient lighting
      mouseReactiveLight.position.x += (state.mousePos.x * 5.2 - mouseReactiveLight.position.x) * 0.08;
      mouseReactiveLight.position.y += (state.mousePos.y * 3.6 - mouseReactiveLight.position.y) * 0.08;

      // Smooth hover pause factor (eases smoothly to 0 on hover, resumes on exit)
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
        // Inertia decay
        state.scrollPos += state.velocity;
        state.velocity *= 0.92;

        if (Math.abs(state.velocity) < 0.0004) {
          state.velocity = 0;
          // Auto-drift marquee smoothly glides forward
          state.scrollPos += baseDriftSpeed * state.hoverFactor;
        }
      }

      // --- 7. VIRTUALIZED POOL MESH POSITIONING & TEXTURE RECYCLING ---
      const centerSlot = Math.round(state.scrollPos);

      // Relative slot offsets: -3 to +3 (exactly 7 active slots)
      for (let k = -3; k <= 3; k++) {
        const virtualSlot = centerSlot + k;
        const offset = virtualSlot - state.scrollPos;

        // Modulo 7 maps each continuous integer to a unique pool mesh
        const poolIndex = ((virtualSlot % POOL_SIZE) + POOL_SIZE) % POOL_SIZE;
        const meshGroup = poolMeshes[poolIndex];

        // Modulo N maps to actual item in album
        const photoIndex = ((virtualSlot % totalItems) + totalItems) % totalItems;
        const item = items[photoIndex];

        // Recycle texture when this mesh slot takes on a new photo index
        if (meshGroup.userData.photoIndex !== photoIndex) {
          meshGroup.userData.photoIndex = photoIndex;
          meshGroup.userData.item = item;
          meshGroup.userData.virtualSlot = virtualSlot;

          const photoMesh = meshGroup.userData.photoMesh as THREE.Mesh;
          const photoMat = photoMesh.material as THREE.MeshStandardMaterial;

          if (textureCache.has(photoIndex)) {
            photoMat.map = textureCache.get(photoIndex)!;
            photoMat.needsUpdate = true;
          } else {
            photoMat.map = getFallbackTexture(photoIndex);
            photoMat.needsUpdate = true;
            loadTextureForIndex(photoIndex);
          }
        }

        // --- 8. WEICHIE 3D HORIZONTAL CURVED PERSPECTIVE ---
        // Global stage cylindrical arc: theta angle
        const theta = offset * 0.38;
        const x = globalArcRadius * Math.sin(theta);
        const z = globalArcRadius * (Math.cos(theta) - 1);

        const isHovered = meshGroup.userData.poolId === state.hoveredSlot;
        const hoverZLift = isHovered ? 0.32 : 0;
        const hoverTiltX = isHovered ? -state.mousePos.y * 0.12 : 0;
        const hoverTiltY = isHovered ? state.mousePos.x * 0.12 : 0;

        meshGroup.position.set(x, 0, z + hoverZLift);
        // Center card faces camera directly (rotY = 0), left/right cards angle naturally
        meshGroup.rotation.set(hoverTiltX, theta * 0.88 + hoverTiltY, 0);

        // Center card gets maximum scale and clarity; edges softly recede
        const scaleBoost = Math.max(0, Math.cos(theta));
        const baseScale = 0.88 + 0.34 * Math.pow(scaleBoost, 2.8);
        const finalScale = isHovered ? baseScale * 1.08 : baseScale;
        meshGroup.scale.set(finalScale, finalScale, finalScale);
      }

      // --- 9. OFFSCREEN TEXTURE PRUNING (<50MB GPU MEMORY) ---
      // Runs every 25 frames to dispose offscreen textures that fell outside visible window
      if (frameCounter % 25 === 0) {
        const activeIndices = new Set<number>();
        for (let k = -4; k <= 4; k++) {
          const v = centerSlot + k;
          const idx = ((v % totalItems) + totalItems) % totalItems;
          activeIndices.add(idx);
        }

        textureCache.forEach((tex, idx) => {
          if (!activeIndices.has(idx)) {
            tex.dispose();
            textureCache.delete(idx);
          }
        });
      }

      // Notify parent of center item changes (for batch indicator sync)
      const currentCenterPhotoIdx = ((centerSlot % totalItems) + totalItems) % totalItems;
      if (currentCenterPhotoIdx !== lastNotifiedIndex) {
        lastNotifiedIndex = currentCenterPhotoIdx;
        onActiveIndexChangeRef.current(currentCenterPhotoIdx);
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- 10. CLEANUP & MEMORY DISPOSAL ---
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

      // Dispose all cached textures
      textureCache.forEach((tex) => tex.dispose());
      textureCache.clear();
      fallbackTextures.forEach((tex) => tex.dispose());
      fallbackTextures.clear();

      // Dispose geometries & materials
      chassisGeo.dispose();
      borderGeo.dispose();
      photoGeo.dispose();
      backplateGeo.dispose();
      chassisMat.dispose();
      glossyMetallicBorderMat.dispose();
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
