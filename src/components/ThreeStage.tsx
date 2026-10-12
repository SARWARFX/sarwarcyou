/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture } from '../utils/textureGenerator';

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

// Helper to create a rounded rectangle Shape
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

  // Rotation control refs for smooth kinetic interaction
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
    scene.fog = new THREE.FogExp2(0x000000, 0.042);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 7.6);
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
    renderer.toneMappingExposure = 1.28;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // --- 3. LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x181c28, 1.4);
    scene.add(ambientLight);

    // Center Top Spotlight shining down on the active portrait frame
    const topSpotLight = new THREE.SpotLight(0xffffff, 6.0, 26, Math.PI / 4.8, 0.55, 1.2);
    topSpotLight.position.set(0, 5.6, 3.2);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Front soft directional key light
    const frontKeyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    frontKeyLight.position.set(0, 2, 6);
    scene.add(frontKeyLight);

    // Cyan metallic rim light on left
    const leftRimLight = new THREE.PointLight(0x00d2ff, 3.4, 20);
    leftRimLight.position.set(-5.5, 1.5, 2.2);
    scene.add(leftRimLight);

    // Magenta/Pink metallic rim light on right
    const rightRimLight = new THREE.PointLight(0xff2a85, 3.4, 20);
    rightRimLight.position.set(5.5, 1.5, 2.2);
    scene.add(rightRimLight);

    // Stage ground violet up-light
    const stageGlowLight = new THREE.PointLight(0x9d00ff, 2.8, 14);
    stageGlowLight.position.set(0, -2.8, 1.2);
    scene.add(stageGlowLight);

    // --- 4. TOP FLOATING HALO RING ---
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 2.3, 0);

    const haloGeo1 = new THREE.TorusGeometry(1.35, 0.022, 16, 100);
    const haloMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const haloMesh1 = new THREE.Mesh(haloGeo1, haloMat1);
    haloMesh1.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh1);

    const haloGeo2 = new THREE.TorusGeometry(1.45, 0.012, 16, 100);
    const haloMat2 = new THREE.MeshBasicMaterial({ color: 0xff00aa });
    const haloMesh2 = new THREE.Mesh(haloGeo2, haloMat2);
    haloMesh2.rotation.x = Math.PI / 2;
    haloGroup.add(haloMesh2);

    scene.add(haloGroup);

    // --- 5. BOTTOM METALLIC PEDESTAL ---
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -2.25, 0);

    const baseGeo = new THREE.CylinderGeometry(1.75, 2.0, 0.22, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x14161f,
      metalness: 0.95,
      roughness: 0.18,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    pedestalGroup.add(baseMesh);

    // Concentric neon rings
    const ringGeo1 = new THREE.TorusGeometry(1.55, 0.018, 16, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringMesh1.position.y = 0.115;
    ringMesh1.rotation.x = Math.PI / 2;
    pedestalGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(1.15, 0.014, 16, 80);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xff007a });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.position.y = 0.115;
    ringMesh2.rotation.x = Math.PI / 2;
    pedestalGroup.add(ringMesh2);

    // Glossy mirror top disk
    const diskGeo = new THREE.CircleGeometry(1.6, 64);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0x08090d,
      metalness: 0.96,
      roughness: 0.08,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.rotation.x = -Math.PI / 2;
    diskMesh.position.y = 0.116;
    pedestalGroup.add(diskMesh);

    scene.add(pedestalGroup);

    // --- 6. 3D PORTRAIT PHOTO FRAMES ---
    const carouselRingGroup = new THREE.Group();
    scene.add(carouselRingGroup);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const totalItems = items.length;
    // Keep at least 10 slots on the ring for beautiful orbital curvature
    const ringCount = Math.max(totalItems, 10);
    const frameMeshes: THREE.Group[] = [];

    // Frame Dimensions: Aspect ~3:4 / portrait panel
    const frameWidth = 2.2;
    const frameHeight = 3.1;
    const frameDepth = 0.07;
    const photoWidth = 2.04;
    const photoHeight = 2.94;

    // Outer Frame Chassis (Dark Brushed Obsidian / Matte Finish)
    const chassisGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameDepth);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x121318,
      metalness: 0.9,
      roughness: 0.32,
    });

    // Front Metallic Chamfer Border Frame (Platinum / Chrome Physical Metal)
    const outerShape = createRoundedRectShape(frameWidth, frameHeight, 0.08);
    const innerHole = createRoundedRectShape(photoWidth, photoHeight, 0.03);
    outerShape.holes.push(innerHole);

    const bevelBorderGeo = new THREE.ExtrudeGeometry(outerShape, {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 3,
    });
    // Center extrusion along Z
    bevelBorderGeo.center();

    const metallicBorderMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6e8f2,
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });

    // Flat Front Photo Display Plane (No barrel distortion, proper flat UVs)
    const photoPlaneGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

    // Dark Obsidian Backplate Plane
    const backplateGeo = new THREE.PlaneGeometry(frameWidth - 0.04, frameHeight - 0.04);
    const backplateMat = new THREE.MeshStandardMaterial({
      color: 0x090a0f,
      metalness: 0.92,
      roughness: 0.28,
    });

    for (let i = 0; i < ringCount; i++) {
      const itemIndex = i % totalItems;
      const item = items[itemIndex];

      const frameGroup = new THREE.Group();
      frameGroup.userData = {
        itemIndex,
        slotIndex: i,
        item,
      };

      // Procedural fallback / placeholder texture
      const proceduralTexture = createProceduralFrameTexture({
        title: item?.title || `Photo ${itemIndex + 1}`,
        category: item?.category || 'Bandhobis',
        index: itemIndex,
        total: totalItems,
      });

      const photoMat = new THREE.MeshStandardMaterial({
        map: proceduralTexture,
        metalness: 0.08,
        roughness: 0.22,
        side: THREE.FrontSide,
      });

      // Load live thumbnail asynchronously with crisp filtering
      if (item?.thumbnail) {
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
            // Keep sleek procedural fallback on load error
          }
        );
      }

      // 1. Frame Chassis Box
      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      frameGroup.add(chassisMesh);

      // 2. Beveled Metallic Outer Frame Border
      const borderMesh = new THREE.Mesh(bevelBorderGeo, metallicBorderMat);
      borderMesh.position.z = frameDepth / 2 + 0.01;
      frameGroup.add(borderMesh);

      // 3. Flat Front Photo Display
      const photoMesh = new THREE.Mesh(photoPlaneGeo, photoMat);
      photoMesh.position.z = frameDepth / 2 + 0.012;
      frameGroup.add(photoMesh);

      // 4. Backplate (Visible when card turns away)
      const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
      backMesh.position.z = -frameDepth / 2 - 0.001;
      backMesh.rotation.y = Math.PI;
      frameGroup.add(backMesh);

      carouselRingGroup.add(frameGroup);
      frameMeshes.push(frameGroup);
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

      // Smooth drag sensitivity
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

      // Click / Raycast detection
      if (!didDragSignificantly) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(carouselRingGroup.children, true);

        if (intersects.length > 0) {
          let hitGroup: THREE.Object3D | null = intersects[0].object;
          while (hitGroup && !hitGroup.userData?.item) {
            hitGroup = hitGroup.parent;
          }

          if (hitGroup && hitGroup.userData) {
            const clickedSlot = hitGroup.userData.slotIndex;
            const clickedItem = hitGroup.userData.item;

            const currentNearestSlot =
              (Math.round(-rotationStateRef.current.currentAngle / stepAngle) % ringCount + ringCount) % ringCount;

            if (clickedSlot === currentNearestSlot) {
              // Clicked the active frame -> open lightbox modal!
              onSelectActiveItemRef.current(clickedItem);
            } else {
              // Clicked background frame -> rotate to it!
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
    const orbitalRadius = 5.0;
    let lastNotifiedIndex = activeIndexRef.current;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const state = rotationStateRef.current;

      // 1. Programmatic rotation
      if (state.programmaticTarget !== null) {
        state.currentAngle += (state.programmaticTarget - state.currentAngle) * 0.12;
        if (Math.abs(state.programmaticTarget - state.currentAngle) < 0.001) {
          state.currentAngle = state.programmaticTarget;
          state.programmaticTarget = null;
        }
      } else if (!state.isDragging) {
        // 2. Inertia physics
        state.currentAngle += state.velocity;
        state.velocity *= 0.91;

        // 3. Auto-snap
        if (Math.abs(state.velocity) < 0.0015) {
          const nearestSlot = Math.round(-state.currentAngle / stepAngle);
          const snapTarget = -nearestSlot * stepAngle;
          state.currentAngle += (snapTarget - state.currentAngle) * 0.1;
        }
      }

      // Halo levitation
      haloGroup.position.y = 2.3 + Math.sin(elapsedTime * 2.2) * 0.04;
      haloGroup.rotation.z = elapsedTime * 0.35;

      // Pedestal pulse
      ringMesh1.scale.setScalar(1 + Math.sin(elapsedTime * 3) * 0.02);

      // Position each portrait frame on the orbital circle
      let closestDistance = Infinity;
      let activeSlot = 0;

      frameMeshes.forEach((mesh) => {
        const slot = mesh.userData.slotIndex;
        const angle = slot * stepAngle + state.currentAngle;

        // Normalize to [-PI, PI]
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

        // Active center item scaling (~1.25x) & background items depth scale (~0.85x)
        const scaleBoost = Math.max(0, Math.cos(normalizedAngle));
        const scale = 0.85 + 0.40 * Math.pow(scaleBoost, 2.5);
        mesh.scale.set(scale, scale, scale);

        // Organic idle hover for active center frame
        if (absNormAngle < 0.25) {
          mesh.position.y = Math.sin(elapsedTime * 1.8) * 0.05;
        } else {
          mesh.position.y = 0;
        }
      });

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
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [items]);

  // Synchronize when activeIndex prop updates from UI (chevrons / scrubber)
  useEffect(() => {
    if (!items.length) return;
    const ringCount = Math.max(items.length, 10);
    const stepAngle = (2 * Math.PI) / ringCount;
    const currentNearestSlot =
      (Math.round(-rotationStateRef.current.currentAngle / stepAngle) % ringCount + ringCount) % ringCount;
    const targetSlot = activeIndex % ringCount;

    if (currentNearestSlot !== targetSlot) {
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
