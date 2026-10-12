/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralCanTexture } from '../utils/textureGenerator';

export interface StageMediaItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  category: string;
  type: 'video' | 'image';
}

interface ThreeStageProps {
  items: StageMediaItem[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelectActiveItem: (item: StageMediaItem) => void;
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

  // Rotation control refs for smooth interaction
  const rotationStateRef = useRef({
    currentAngle: 0,
    targetAngle: 0,
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

    // --- 1. SCENE & CAMERA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.045);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 7.4);
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
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- 3. LIGHTING ---
    // Ambient cool fill
    const ambientLight = new THREE.AmbientLight(0x161a26, 1.2);
    scene.add(ambientLight);

    // Center Top Spotlight shining down on the active item
    const topSpotLight = new THREE.SpotLight(0xffffff, 5.5, 24, Math.PI / 5, 0.6, 1.2);
    topSpotLight.position.set(0, 5.2, 2.8);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Front soft key light
    const frontKeyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    frontKeyLight.position.set(0, 1.5, 6);
    scene.add(frontKeyLight);

    // Cyan metallic rim light on left
    const leftRimLight = new THREE.PointLight(0x00d2ff, 3.2, 18);
    leftRimLight.position.set(-5.5, 1.2, 2.0);
    scene.add(leftRimLight);

    // Magenta/Pink metallic rim light on right
    const rightRimLight = new THREE.PointLight(0xff2a85, 3.2, 18);
    rightRimLight.position.set(5.5, 1.2, 2.0);
    scene.add(rightRimLight);

    // Stage ground violet up-light
    const stageGlowLight = new THREE.PointLight(0x9d00ff, 2.5, 12);
    stageGlowLight.position.set(0, -2.5, 1.0);
    scene.add(stageGlowLight);

    // --- 4. TOP FLOATING HALO RING ---
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 2.05, 0);

    // Outer cyan halo torus
    const haloGeo1 = new THREE.TorusGeometry(1.22, 0.022, 16, 100);
    const haloMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const haloMesh1 = new THREE.Mesh(haloGeo1, haloMat1);
    haloMesh1.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh1);

    // Inner magenta halo torus
    const haloGeo2 = new THREE.TorusGeometry(1.32, 0.012, 16, 100);
    const haloMat2 = new THREE.MeshBasicMaterial({ color: 0xff00aa });
    const haloMesh2 = new THREE.Mesh(haloGeo2, haloMat2);
    haloMesh2.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh2);

    scene.add(haloGroup);

    // --- 5. BOTTOM METALLIC PEDESTAL ---
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -2.0, 0);

    // Base beveled cylinder
    const baseGeo = new THREE.CylinderGeometry(1.65, 1.9, 0.24, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x14161f,
      metalness: 0.95,
      roughness: 0.18,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    pedestalGroup.add(baseMesh);

    // Concentric neon ring 1 (Cyan)
    const ringGeo1 = new THREE.TorusGeometry(1.45, 0.018, 16, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.position.y = 0.125;
    ringMesh1.rotation.x = Math.PI / 2;
    pedestalGroup.add(ringMesh1);

    // Concentric neon ring 2 (Pink)
    const ringGeo2 = new THREE.TorusGeometry(1.1, 0.014, 16, 80);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xff007a });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.position.y = 0.125;
    ringMesh2.rotation.x = Math.PI / 2;
    pedestalGroup.add(ringMesh2);

    // Glossy mirror top disk
    const diskGeo = new THREE.CircleGeometry(1.5, 64);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0x08090d,
      metalness: 0.95,
      roughness: 0.08,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.rotation.x = -Math.PI / 2;
    diskMesh.position.y = 0.126;
    pedestalGroup.add(diskMesh);

    scene.add(pedestalGroup);

    // --- 6. 3D CAN MESHES & TEXTURES ---
    const carouselRingGroup = new THREE.Group();
    scene.add(carouselRingGroup);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const totalItems = items.length;
    // Minimum 10 slots for smooth orbital curvature
    const ringCount = Math.max(totalItems, 10);
    const canMeshes: THREE.Group[] = [];

    // Shared geometry for metal rims & lids
    const canBodyGeo = new THREE.CylinderGeometry(0.72, 0.72, 2.25, 48, 1, true);
    const topRimGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.08, 48);
    const topLidGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.03, 48);
    const bottomRimGeo = new THREE.CylinderGeometry(0.72, 0.66, 0.12, 48);
    const bottomBaseGeo = new THREE.CylinderGeometry(0.64, 0.64, 0.03, 48);

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddf,
      metalness: 0.95,
      roughness: 0.15,
    });

    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x9999a4,
      metalness: 0.88,
      roughness: 0.28,
    });

    for (let i = 0; i < ringCount; i++) {
      const itemIndex = i % totalItems;
      const item = items[itemIndex];

      const canGroup = new THREE.Group();
      canGroup.userData = {
        itemIndex,
        slotIndex: i,
        item,
      };

      // Procedural fallback texture
      const proceduralTexture = createProceduralCanTexture({
        title: item?.title || `Item ${itemIndex + 1}`,
        category: item?.category || 'Vault',
        index: itemIndex,
        total: totalItems,
      });

      const bodyMat = new THREE.MeshStandardMaterial({
        map: proceduralTexture,
        metalness: 0.5,
        roughness: 0.28,
        side: THREE.DoubleSide,
      });

      // Load thumbnail asynchronously
      if (item?.thumbnail) {
        textureLoader.load(
          item.thumbnail,
          (loadedTex) => {
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            loadedTex.wrapS = THREE.ClampToEdgeWrapping;
            loadedTex.wrapT = THREE.ClampToEdgeWrapping;
            bodyMat.map = loadedTex;
            bodyMat.needsUpdate = true;
          },
          undefined,
          () => {
            // Keep procedural texture on error
          }
        );
      }

      // 1. Can Body
      const bodyMesh = new THREE.Mesh(canBodyGeo, bodyMat);
      canGroup.add(bodyMesh);

      // 2. Top Rim
      const topRimMesh = new THREE.Mesh(topRimGeo, chromeMat);
      topRimMesh.position.y = 1.16;
      canGroup.add(topRimMesh);

      // 3. Top Lid
      const topLidMesh = new THREE.Mesh(topLidGeo, lidMat);
      topLidMesh.position.y = 1.19;
      canGroup.add(topLidMesh);

      // 4. Bottom Rim
      const bottomRimMesh = new THREE.Mesh(bottomRimGeo, chromeMat);
      bottomRimMesh.position.y = -1.18;
      canGroup.add(bottomRimMesh);

      // 5. Bottom Base
      const bottomBaseMesh = new THREE.Mesh(bottomBaseGeo, lidMat);
      bottomBaseMesh.position.y = -1.21;
      canGroup.add(bottomBaseMesh);

      carouselRingGroup.add(canGroup);
      canMeshes.push(canGroup);
    }

    // Set initial angle so active item is centered
    const stepAngle = (2 * Math.PI) / ringCount;
    rotationStateRef.current.currentAngle = -activeIndex * stepAngle;
    rotationStateRef.current.targetAngle = -activeIndex * stepAngle;

    // --- 7. INTERACTION LISTENERS (DRAG, TOUCH, WHEEL, CLICK) ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let isPointerDown = false;
    let didDragSignificantly = false;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      didDragSignificantly = false;
      rotationStateRef.current.isDragging = true;
      rotationStateRef.current.startX = e.clientX;
      rotationStateRef.current.lastX = e.clientX;
      rotationStateRef.current.lastTime = performance.now();
      rotationStateRef.current.velocity = 0;
      rotationStateRef.current.programmaticTarget = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;

      const deltaX = e.clientX - rotationStateRef.current.lastX;
      if (Math.abs(e.clientX - rotationStateRef.current.startX) > 6) {
        didDragSignificantly = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - rotationStateRef.current.lastTime);

      // Sensitivity factor
      const sensitivity = 3.6 / window.innerWidth;
      const angleDelta = deltaX * sensitivity;

      rotationStateRef.current.currentAngle += angleDelta;
      rotationStateRef.current.targetAngle = rotationStateRef.current.currentAngle;
      rotationStateRef.current.velocity = (angleDelta / dt) * 16;

      rotationStateRef.current.lastX = e.clientX;
      rotationStateRef.current.lastTime = now;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      rotationStateRef.current.isDragging = false;

      // Handle Click / Raycast if user didn't drag significantly
      if (!didDragSignificantly) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(carouselRingGroup.children, true);

        if (intersects.length > 0) {
          // Find parent can group
          let hitGroup: THREE.Object3D | null = intersects[0].object;
          while (hitGroup && !hitGroup.userData?.item) {
            hitGroup = hitGroup.parent;
          }

          if (hitGroup && hitGroup.userData) {
            const clickedSlot = hitGroup.userData.slotIndex;
            const clickedItem = hitGroup.userData.item;

            // Check if this is the active centered item
            const currentNearestSlot = (Math.round(-rotationStateRef.current.currentAngle / stepAngle) % ringCount + ringCount) % ringCount;

            if (clickedSlot === currentNearestSlot) {
              // Clicked the active item -> open stream!
              onSelectActiveItemRef.current(clickedItem);
            } else {
              // Clicked a background item -> rotate to it!
              rotationStateRef.current.programmaticTarget = -clickedSlot * stepAngle;
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rotationStateRef.current.velocity += e.deltaY * 0.00032;
      rotationStateRef.current.programmaticTarget = null;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
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
    const orbitalRadius = 4.8;
    let lastNotifiedIndex = activeIndexRef.current;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const state = rotationStateRef.current;

      // 1. Programmatic rotation (e.g. from chevron or clicking background mesh)
      if (state.programmaticTarget !== null) {
        state.currentAngle += (state.programmaticTarget - state.currentAngle) * 0.12;
        if (Math.abs(state.programmaticTarget - state.currentAngle) < 0.001) {
          state.currentAngle = state.programmaticTarget;
          state.programmaticTarget = null;
        }
      } else if (!state.isDragging) {
        // 2. Kinetic inertia damping
        state.currentAngle += state.velocity;
        state.velocity *= 0.91; // smooth deceleration

        // 3. Auto-snap when slow
        if (Math.abs(state.velocity) < 0.0015) {
          const nearestSlot = Math.round(-state.currentAngle / stepAngle);
          const snapTarget = -nearestSlot * stepAngle;
          state.currentAngle += (snapTarget - state.currentAngle) * 0.1;
        }
      }

      // Floating halo animation
      haloGroup.position.y = 2.05 + Math.sin(elapsedTime * 2.2) * 0.04;
      haloGroup.rotation.z = elapsedTime * 0.35;

      // Pedestal pulsing light
      ringMesh1.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.02);

      // Position each can on the orbital cylinder
      let closestDistance = Infinity;
      let activeSlot = 0;

      canMeshes.forEach((mesh) => {
        const slot = mesh.userData.slotIndex;
        const angle = slot * stepAngle + state.currentAngle;

        // Normalize angle to [-PI, PI]
        const normalizedAngle = THREE.MathUtils.euclideanModulo(angle + Math.PI, 2 * Math.PI) - Math.PI;

        const x = orbitalRadius * Math.sin(normalizedAngle);
        const z = orbitalRadius * Math.cos(normalizedAngle) - orbitalRadius;

        mesh.position.set(x, 0, z);
        mesh.rotation.y = normalizedAngle;

        const absNormAngle = Math.abs(normalizedAngle);
        if (absNormAngle < closestDistance) {
          closestDistance = absNormAngle;
          activeSlot = slot;
        }

        // Active center item scaling (~1.25x) & background items falloff (~0.85x)
        const scaleBoost = Math.max(0, Math.cos(normalizedAngle));
        const scale = 0.85 + 0.40 * Math.pow(scaleBoost, 2.5);
        mesh.scale.set(scale, scale, scale);

        // Gentle levitation for active center item
        if (absNormAngle < 0.25) {
          mesh.position.y = Math.sin(elapsedTime * 1.8) * 0.05;
        } else {
          mesh.position.y = 0;
        }
      });

      // Notify parent when active index changes
      const calculatedActiveIndex = activeSlot % totalItems;
      if (calculatedActiveIndex !== lastNotifiedIndex) {
        lastNotifiedIndex = calculatedActiveIndex;
        onActiveIndexChangeRef.current(calculatedActiveIndex);
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

      canMeshes.forEach((group) => {
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
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [items]);

  // Synchronize when activeIndex prop is triggered from UI (chevrons / scrubber)
  useEffect(() => {
    if (!items.length) return;
    const ringCount = Math.max(items.length, 10);
    const stepAngle = (2 * Math.PI) / ringCount;
    const currentNearestSlot = (Math.round(-rotationStateRef.current.currentAngle / stepAngle) % ringCount + ringCount) % ringCount;
    const targetSlot = activeIndex % ringCount;

    if (currentNearestSlot !== targetSlot) {
      // Find shortest angular distance
      let diff = targetSlot - currentNearestSlot;
      if (diff > ringCount / 2) diff -= ringCount;
      if (diff < -ringCount / 2) diff += ringCount;

      const currentNearestAngle = Math.round(-rotationStateRef.current.currentAngle / stepAngle) * -stepAngle;
      rotationStateRef.current.programmaticTarget = currentNearestAngle - diff * stepAngle;
    }
  }, [activeIndex, items.length]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0"
    />
  );
};
