/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture } from '../utils/textureGenerator';
import type { StageMediaItem } from '../types';

export type { StageMediaItem };

interface ThreeStageProps {
  items: StageMediaItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectActiveItem: (item: StageMediaItem) => void;
}

// Helper to create rounded rectangle Shape for frames
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

export const ThreeStage: React.FC<ThreeStageProps> = ({
  items,
  activeIndex,
  onActiveIndexChange,
  onSelectActiveItem,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const onSelectActiveItemRef = useRef(onSelectActiveItem);
  const itemsRef = useRef(items);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    onActiveIndexChangeRef.current = onActiveIndexChange;
    onSelectActiveItemRef.current = onSelectActiveItem;
    itemsRef.current = items;
  }, [activeIndex, onActiveIndexChange, onSelectActiveItem, items]);

  // Inertia and kinetic drag state
  const animStateRef = useRef({
    currentIndex: activeIndex as number,
    targetIndex: activeIndex as number,
    velocity: 0,
    isDragging: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    programmaticTarget: null as number | null,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const itemCount = items.length;
    if (itemCount === 0) return;

    // --- 1. SCENE & CAMERA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.045);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, isPortrait ? 8.8 : 7.0);
    camera.lookAt(0, 0, 0);

    // --- 2. RENDERER ---
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

    // --- 3. LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x1a2035, 1.6);
    scene.add(ambientLight);

    // Center Top Spotlight focused on the active portrait frame
    const topSpotLight = new THREE.SpotLight(0xffffff, 6.5, 25, Math.PI / 4.5, 0.5, 1.2);
    topSpotLight.position.set(0, 5.5, 3.2);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Soft front directional key light
    const frontKeyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    frontKeyLight.position.set(0, 2.5, 6);
    scene.add(frontKeyLight);

    // Neon Electric-Blue Rim Light (Left)
    const electricBlueRim = new THREE.PointLight(0x00d2ff, 4.0, 22);
    electricBlueRim.position.set(-5.5, 1.5, 2.0);
    scene.add(electricBlueRim);

    // Subtle Indigo/Magenta Rim Light (Right)
    const rightRimLight = new THREE.PointLight(0x3b82f6, 3.5, 22);
    rightRimLight.position.set(5.5, 1.5, 2.0);
    scene.add(rightRimLight);

    // Deep Stage Floor Glow
    const floorGlowLight = new THREE.PointLight(0x0055ff, 2.2, 12);
    floorGlowLight.position.set(0, -2.5, 1.0);
    scene.add(floorGlowLight);

    // --- 4. TOP FLOATING HALO RING (Neon Electric Blue) ---
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 2.35, 0);

    const haloGeo1 = new THREE.TorusGeometry(1.35, 0.02, 16, 90);
    const haloMat1 = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const haloMesh1 = new THREE.Mesh(haloGeo1, haloMat1);
    haloMesh1.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh1);

    const haloGeo2 = new THREE.TorusGeometry(1.48, 0.012, 16, 90);
    const haloMat2 = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const haloMesh2 = new THREE.Mesh(haloGeo2, haloMat2);
    haloMesh2.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh2);

    scene.add(haloGroup);

    // --- 5. BOTTOM METALLIC PEDESTAL ---
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -2.25, 0);

    const baseGeo = new THREE.CylinderGeometry(1.75, 1.95, 0.22, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0e111a,
      metalness: 0.95,
      roughness: 0.25,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    pedestalGroup.add(baseMesh);

    // Glowing Neon Inset Rings on Pedestal
    const ringGeo1 = new THREE.TorusGeometry(1.5, 0.022, 16, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.rotation.x = Math.PI / 2;
    ringMesh1.position.y = 0.115;
    pedestalGroup.add(ringMesh1);

    scene.add(pedestalGroup);

    // --- 6. SHALLOW ORBITAL ARC FRAMES (5 TO 6 ITEMS ONLY) ---
    const galleryGroup = new THREE.Group();
    scene.add(galleryGroup);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    // 3:4 Vertical Portrait Dimensions
    const frameWidth = 2.15;
    const frameHeight = 3.05;
    const frameDepth = 0.07;
    const photoWidth = 2.0;
    const photoHeight = 2.9;

    // Outer Chassis: Dark Obsidian Metallic Finish
    const chassisGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x10131d,
      metalness: 0.92,
      roughness: 0.28,
    });

    // Sleek Metallic Bevel Outer Border (MeshPhysicalMaterial)
    const outerShape = createRoundedRectShape(frameWidth, frameHeight, 0.07);
    const innerHole = createRoundedRectShape(photoWidth, photoHeight, 0.025);
    outerShape.holes.push(innerHole);

    const bevelBorderGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.014,
      bevelSegments: 3,
    });
    bevelBorderGeo.center();

    const metallicBorderMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef2ff,
      metalness: 0.96,
      roughness: 0.12,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    });

    // Flat Front Photo Plane
    const photoPlaneGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

    // Brushed Obsidian Backplate
    const backplateGeo = new THREE.PlaneGeometry(frameWidth - 0.03, frameHeight - 0.03);
    const backplateMat = new THREE.MeshStandardMaterial({
      color: 0x080a12,
      metalness: 0.95,
      roughness: 0.25,
    });

    const frameMeshes: THREE.Group[] = [];

    items.forEach((item, index) => {
      const frameGroup = new THREE.Group();
      frameGroup.userData = {
        index,
        item,
      };

      // Procedural Texture Fallback
      const fallbackTex = createProceduralFrameTexture({
        title: item.title,
        category: item.category,
        index,
        total: itemCount,
      });

      const photoMat = new THREE.MeshStandardMaterial({
        map: fallbackTex,
        metalness: 0.08,
        roughness: 0.22,
        side: THREE.FrontSide,
      });

      // Load high-res thumbnail asynchronously
      if (item.thumbnail) {
        textureLoader.load(
          item.thumbnail,
          (loadedTex) => {
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.generateMipmaps = true;
            loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
            loadedTex.magFilter = THREE.LinearFilter;
            photoMat.map = loadedTex;
            photoMat.needsUpdate = true;
          },
          undefined,
          () => {
            // Keep procedural texture on error
          }
        );
      }

      // 1. Chassis
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      frameGroup.add(chassisMesh);

      // 2. Beveled Metallic Border
      const borderMesh = new THREE.Mesh(bevelBorderGeo, metallicBorderMat);
      borderMesh.position.z = frameDepth / 2 + 0.01;
      frameGroup.add(borderMesh);

      // 3. Photo Face
      const photoMesh = new THREE.Mesh(photoPlaneGeo, photoMat);
      photoMesh.position.z = frameDepth / 2 + 0.012;
      frameGroup.add(photoMesh);

      // 4. Backplate
      const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
      backMesh.position.z = -frameDepth / 2 - 0.001;
      backMesh.rotation.y = Math.PI;
      frameGroup.add(backMesh);

      galleryGroup.add(frameGroup);
      frameMeshes.push(frameGroup);
    });

    // Reset initial animation index
    const initialIdx = Math.min(Math.max(0, activeIndexRef.current), itemCount - 1);
    animStateRef.current.currentIndex = initialIdx;
    animStateRef.current.targetIndex = initialIdx;
    animStateRef.current.velocity = 0;
    animStateRef.current.programmaticTarget = null;

    // --- 7. POINTER & WHEEL INTERACTIONS ---
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
      if (!isPointerDown) return;

      const deltaX = e.clientX - animStateRef.current.lastX;
      if (Math.abs(e.clientX - animStateRef.current.startX) > 7) {
        didDragSignificantly = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - animStateRef.current.lastTime);

      // Sensitivity tuned for a shallow 5-6 item arc
      const sensitivity = 2.4 / window.innerWidth;
      const indexDelta = -deltaX * sensitivity;

      animStateRef.current.currentIndex += indexDelta;
      // Elastic soft clamp on boundaries
      animStateRef.current.currentIndex = Math.max(
        -0.3,
        Math.min(itemCount - 1 + 0.3, animStateRef.current.currentIndex)
      );

      animStateRef.current.velocity = (indexDelta / dt) * 16;
      animStateRef.current.lastX = e.clientX;
      animStateRef.current.lastTime = now;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      animStateRef.current.isDragging = false;

      // Click detection
      if (!didDragSignificantly) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(galleryGroup.children, true);

        if (intersects.length > 0) {
          let hitGroup: THREE.Object3D | null = intersects[0].object;
          while (hitGroup && !hitGroup.userData?.item) {
            hitGroup = hitGroup.parent;
          }

          if (hitGroup && hitGroup.userData) {
            const clickedIdx = hitGroup.userData.index;
            const clickedItem = hitGroup.userData.item;
            const currentRounded = Math.round(animStateRef.current.currentIndex);

            if (clickedIdx === currentRounded) {
              // Clicked the active frame -> Open fullscreen high-res lightbox!
              onSelectActiveItemRef.current(clickedItem);
            } else {
              // Clicked neighboring frame -> Smoothly slide into focus!
              animStateRef.current.programmaticTarget = clickedIdx;
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      animStateRef.current.velocity += e.deltaY * 0.00045;
      animStateRef.current.programmaticTarget = null;
    };

    const onResize = () => {
      const portraitNow = window.innerWidth < 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = portraitNow ? 8.8 : 7.0;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    // --- 8. ANIMATION LOOP ---
    let animationFrameId: number;
    const clock = new THREE.Clock();
    // Arc radius and spacing for 5-6 frames
    const arcRadius = 5.8;
    const angleSpacing = 0.29; // ~16.6 degrees per frame
    let lastNotified = initialIdx;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const state = animStateRef.current;

      // 1. Programmatic Transition
      if (state.programmaticTarget !== null) {
        state.currentIndex += (state.programmaticTarget - state.currentIndex) * 0.14;
        if (Math.abs(state.programmaticTarget - state.currentIndex) < 0.002) {
          state.currentIndex = state.programmaticTarget;
          state.programmaticTarget = null;
        }
      } else if (!state.isDragging) {
        // 2. Kinetic Inertia
        state.currentIndex += state.velocity;
        state.velocity *= 0.88;

        // Clamping bounds
        if (state.currentIndex < 0) {
          state.currentIndex += (0 - state.currentIndex) * 0.18;
          state.velocity = 0;
        } else if (state.currentIndex > itemCount - 1) {
          state.currentIndex += (itemCount - 1 - state.currentIndex) * 0.18;
          state.velocity = 0;
        }

        // 3. Auto-Snap to Nearest Integer Slot
        if (Math.abs(state.velocity) < 0.0018) {
          const nearest = Math.round(state.currentIndex);
          state.currentIndex += (nearest - state.currentIndex) * 0.12;
        }
      }

      // Halo Levitation
      haloGroup.position.y = 2.35 + Math.sin(elapsedTime * 2.2) * 0.035;
      haloGroup.rotation.z = elapsedTime * 0.35;

      // Pedestal Ring Pulse
      ringMesh1.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.02);

      // Position each frame in the shallow orbital arc
      let activeIndexCalculated = Math.round(
        Math.max(0, Math.min(itemCount - 1, state.currentIndex))
      );

      frameMeshes.forEach((mesh) => {
        const slot = mesh.userData.index;
        const offset = slot - state.currentIndex;
        const theta = offset * angleSpacing;

        // Shallow orbital arc mathematics:
        // x moves sideways along the circle, z curves gently backward
        const x = arcRadius * Math.sin(theta);
        const z = arcRadius * (Math.cos(theta) - 1);

        mesh.position.set(x, 0, z);
        // Face inward toward the viewer
        mesh.rotation.y = theta * 0.86;

        const absOffset = Math.abs(offset);

        // Prominent scale boost on the active center frame
        const scaleBoost = Math.max(0, Math.cos(theta));
        const scale = 0.88 + 0.32 * Math.pow(scaleBoost, 2.8);
        mesh.scale.set(scale, scale, scale);

        // Subtle organic float on the focused center frame
        if (absOffset < 0.3) {
          mesh.position.y = Math.sin(elapsedTime * 1.8) * 0.045;
        } else {
          mesh.position.y = 0;
        }
      });

      if (activeIndexCalculated !== lastNotified) {
        lastNotified = activeIndexCalculated;
        onActiveIndexChangeRef.current(activeIndexCalculated);
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      frameMeshes.forEach((group) => {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
      });

      renderer.dispose();
      if (dom && dom.parentNode) {
        dom.parentNode.removeChild(dom);
      }
    };
  }, [items]);

  // Synchronize external activeIndex changes (e.g. from pagination or buttons)
  useEffect(() => {
    if (!items.length) return;
    const target = Math.max(0, Math.min(items.length - 1, activeIndex));
    const currentNearest = Math.round(animStateRef.current.currentIndex);

    if (currentNearest !== target) {
      animStateRef.current.programmaticTarget = target;
    }
  }, [activeIndex, items.length]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0"
    />
  );
};
