/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture, createComingSoonTexture } from '../utils/textureGenerator';
import type { AlbumData, StageMediaItem } from '../types';

interface AlbumStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

// Helper for rounded rectangle Shapes
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

export const AlbumStage: React.FC<AlbumStageProps> = ({
  album,
  isActive,
  onSelectItem,
  activeIndex,
  onActiveIndexChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  const onSelectItemRef = useRef(onSelectItem);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    onActiveIndexChangeRef.current = onActiveIndexChange;
    onSelectItemRef.current = onSelectItem;
  }, [activeIndex, onActiveIndexChange, onSelectItem]);

  const animStateRef = useRef({
    currentIndex: activeIndex as number,
    velocity: 0,
    isDragging: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    programmaticTarget: null as number | null,
    mousePos: new THREE.Vector2(0, 0),
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');
    // Display up to 6 items per stage
    const stageItems = album.items.slice(0, 6);
    const itemCount = isComingSoon ? 1 : stageItems.length;

    // --- 1. SCENE & CAMERA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.04);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, isPortrait ? 9.2 : 7.2);
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

    // --- 3. DYNAMIC LIGHTING ACCORDING TO ALBUM DESIGN ---
    const ambientLight = new THREE.AmbientLight(0x151c2e, 1.8);
    scene.add(ambientLight);

    const topSpotLight = new THREE.SpotLight(0xffffff, 6.0, 26, Math.PI / 4.2, 0.5, 1.2);
    topSpotLight.position.set(0, 5.5, 3.2);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(0, 2.5, 6);
    scene.add(keyLight);

    // Layout-specific color theme
    let primaryRimColor = 0x00d2ff; // Cyan
    let secondaryRimColor = 0x3b82f6; // Blue

    switch (album.layoutType) {
      case 'depth-cascade':
        primaryRimColor = 0x9d00ff;
        secondaryRimColor = 0x00d2ff;
        break;
      case 'ribbon-slider':
        primaryRimColor = 0x00f5a0;
        secondaryRimColor = 0x0072ff;
        break;
      case 'showcase-hero':
        primaryRimColor = 0xffffff;
        secondaryRimColor = 0x00d2ff;
        break;
      case 'grid-wall':
        primaryRimColor = 0xffa500;
        secondaryRimColor = 0x3b82f6;
        break;
      case 'theater-cylinder':
        primaryRimColor = 0xff007a;
        secondaryRimColor = 0x00d2ff;
        break;
      case 'spiral-helix':
        primaryRimColor = 0x00e5ff;
        secondaryRimColor = 0x7000ff;
        break;
      case 'perspective-tunnel':
        primaryRimColor = 0x00ffcc;
        secondaryRimColor = 0xff0055;
        break;
      case 'vertical-waterfall':
        primaryRimColor = 0xff00aa;
        secondaryRimColor = 0x00d2ff;
        break;
      case 'coming-soon-photos':
      case 'coming-soon-videos':
        primaryRimColor = 0x00d2ff;
        secondaryRimColor = 0x3b82f6;
        break;
    }

    const leftRimLight = new THREE.PointLight(primaryRimColor, 4.0, 22);
    leftRimLight.position.set(-5.5, 1.5, 2.0);
    scene.add(leftRimLight);

    const rightRimLight = new THREE.PointLight(secondaryRimColor, 3.8, 22);
    rightRimLight.position.set(5.5, 1.5, 2.0);
    scene.add(rightRimLight);

    // --- 4. BUILD 3D GEOMETRY ---
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const cardGroups: THREE.Group[] = [];
    let comingSoonCoreMesh: THREE.Object3D | null = null;
    let comingSoonRingsGroup: THREE.Group | null = null;

    if (isComingSoon) {
      // ================= COMING SOON 3D STAGE (ALBUMS 11 & 12) =================
      const csGroup = new THREE.Group();
      rootGroup.add(csGroup);

      // Rotating concentric gyroscope / beacon rings
      comingSoonRingsGroup = new THREE.Group();
      csGroup.add(comingSoonRingsGroup);

      const rMat1 = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
      const rMat2 = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
      const rMat3 = new THREE.MeshBasicMaterial({ color: 0xff00aa });

      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.02, 16, 90), rMat1);
      ring1.rotation.x = Math.PI / 2;
      comingSoonRingsGroup.add(ring1);

      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.015, 16, 90), rMat2);
      ring2.rotation.y = Math.PI / 2;
      comingSoonRingsGroup.add(ring2);

      const ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.012, 16, 90), rMat3);
      comingSoonRingsGroup.add(ring3);

      // Core crystal / quantum vault
      if (album.layoutType === 'coming-soon-photos') {
        const octaGeo = new THREE.OctahedronGeometry(1.3, 0);
        const octaMat = new THREE.MeshPhysicalMaterial({
          color: 0x00d2ff,
          metalness: 0.1,
          roughness: 0.1,
          transmission: 0.85,
          thickness: 1.2,
          wireframe: false,
        });
        const crystalMesh = new THREE.Mesh(octaGeo, octaMat);
        csGroup.add(crystalMesh);

        // Wireframe cage
        const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const wireMesh = new THREE.Mesh(octaGeo, wireMat);
        wireMesh.scale.setScalar(1.02);
        crystalMesh.add(wireMesh);

        comingSoonCoreMesh = crystalMesh;
      } else {
        const sphereGeo = new THREE.IcosahedronGeometry(1.2, 2);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: 0x0a1020,
          emissive: 0x0044ff,
          emissiveIntensity: 0.6,
          metalness: 0.95,
          roughness: 0.2,
        });
        const vaultSphere = new THREE.Mesh(sphereGeo, sphereMat);
        csGroup.add(vaultSphere);

        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true });
        const wireMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), wireMat);
        vaultSphere.add(wireMesh);

        comingSoonCoreMesh = vaultSphere;
      }

      // Floating holographic badge plane
      const csBadgeTex = createComingSoonTexture(album.name, album.subtitle || '2027 ARCHIVE');
      const csBadgeMat = new THREE.MeshBasicMaterial({
        map: csBadgeTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const csBadge = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), csBadgeMat);
      csBadge.position.set(0, -0.1, 0.1);
      csGroup.add(csBadge);

      // Ambient pedestal
      const pedGeo = new THREE.CylinderGeometry(2.0, 2.3, 0.2, 48);
      const pedMat = new THREE.MeshStandardMaterial({ color: 0x080c14, metalness: 0.9, roughness: 0.3 });
      const pedMesh = new THREE.Mesh(pedGeo, pedMat);
      pedMesh.position.y = -2.4;
      csGroup.add(pedMesh);
    } else {
      // ================= 10 UNIQUE MEDIA GALLERY LAYOUTS =================
      const isVideoType = album.type === 'video';
      const isShorts = album.layoutType === 'vertical-waterfall';

      // Dimensions based on aspect ratio
      const cardWidth = isShorts ? 1.85 : isVideoType ? 3.1 : 2.15;
      const cardHeight = isShorts ? 3.2 : isVideoType ? 1.85 : 3.05;
      const cardDepth = 0.07;
      const photoWidth = cardWidth - 0.14;
      const photoHeight = cardHeight - 0.14;

      const chassisGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x0f121b,
        metalness: 0.92,
        roughness: 0.28,
      });

      const outerShape = createRoundedRectShape(cardWidth, cardHeight, 0.07);
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
      });

      const photoPlaneGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

      const backplateGeo = new THREE.PlaneGeometry(cardWidth - 0.03, cardHeight - 0.03);
      const backplateMat = new THREE.MeshStandardMaterial({
        color: 0x06080e,
        metalness: 0.95,
        roughness: 0.25,
      });

      stageItems.forEach((item, index) => {
        const cardGroup = new THREE.Group();
        cardGroup.userData = { index, item };

        const fallbackTex = createProceduralFrameTexture({
          title: item.title,
          category: item.category || album.name,
          index,
          total: stageItems.length,
        });

        const photoMat = new THREE.MeshStandardMaterial({
          map: fallbackTex,
          metalness: 0.08,
          roughness: 0.22,
          side: THREE.FrontSide,
        });

        if (item.thumbnail) {
          textureLoader.load(
            item.thumbnail,
            (loadedTex) => {
              loadedTex.colorSpace = THREE.SRGBColorSpace;
              loadedTex.generateMipmaps = true;
              photoMat.map = loadedTex;
              photoMat.needsUpdate = true;
            },
            undefined,
            () => {}
          );
        }

        const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
        cardGroup.add(chassisMesh);

        const borderMesh = new THREE.Mesh(bevelBorderGeo, metallicBorderMat);
        borderMesh.position.z = cardDepth / 2 + 0.01;
        cardGroup.add(borderMesh);

        const photoMesh = new THREE.Mesh(photoPlaneGeo, photoMat);
        photoMesh.position.z = cardDepth / 2 + 0.012;
        cardGroup.add(photoMesh);

        const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
        backMesh.position.z = -cardDepth / 2 - 0.001;
        backMesh.rotation.y = Math.PI;
        cardGroup.add(backMesh);

        rootGroup.add(cardGroup);
        cardGroups.push(cardGroup);
      });

      // Special stage decor
      if (album.layoutType === 'shallow-arc' || album.layoutType === 'theater-cylinder') {
        // Pedestal + Halo
        const pedGeo = new THREE.CylinderGeometry(1.8, 2.0, 0.2, 48);
        const pedMat = new THREE.MeshStandardMaterial({ color: 0x0e111a, metalness: 0.95, roughness: 0.25 });
        const pedMesh = new THREE.Mesh(pedGeo, pedMat);
        pedMesh.position.y = -2.25;
        rootGroup.add(pedMesh);

        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.02, 16, 64),
          new THREE.MeshBasicMaterial({ color: primaryRimColor })
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 2.3;
        rootGroup.add(halo);
      } else if (album.layoutType === 'ribbon-slider') {
        // Glowing horizontal ground rail
        const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 16, 32);
        const railMat = new THREE.MeshBasicMaterial({ color: primaryRimColor });
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.rotation.z = Math.PI / 2;
        rail.position.y = -2.1;
        rootGroup.add(rail);
      }
    }

    // --- 5. INTERACTION LISTENERS ---
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

      if (!isPointerDown) return;

      const deltaX = e.clientX - animStateRef.current.lastX;
      if (Math.abs(e.clientX - animStateRef.current.startX) > 7) {
        didDragSignificantly = true;
      }

      const now = performance.now();
      const dt = Math.max(1, now - animStateRef.current.lastTime);

      const sensitivity = 2.4 / window.innerWidth;
      const indexDelta = -deltaX * sensitivity;

      animStateRef.current.currentIndex += indexDelta;
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

      if (!didDragSignificantly && !isComingSoon) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(rootGroup.children, true);

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
              onSelectItemRef.current(clickedItem);
            } else {
              animStateRef.current.programmaticTarget = clickedIdx;
            }
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      // If user holds Shift or horizontal wheel, scroll items in album
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        animStateRef.current.velocity += e.deltaX * 0.0004;
        animStateRef.current.programmaticTarget = null;
      }
    };

    const onResize = () => {
      const portraitNow = window.innerWidth < 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = portraitNow ? 9.2 : 7.2;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    // --- 6. ANIMATION LOOP ---
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let lastNotified = activeIndexRef.current;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const state = animStateRef.current;

      // Coming soon animations
      if (isComingSoon) {
        if (comingSoonCoreMesh) {
          comingSoonCoreMesh.rotation.y = elapsedTime * 0.6;
          comingSoonCoreMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.2;
          comingSoonCoreMesh.position.y = Math.sin(elapsedTime * 2.0) * 0.08;
        }
        if (comingSoonRingsGroup) {
          comingSoonRingsGroup.rotation.y = elapsedTime * 0.4;
          comingSoonRingsGroup.rotation.z = -elapsedTime * 0.25;
        }
        renderer.render(scene, camera);
        return;
      }

      // Drag physics & Auto-snap for media items
      if (state.programmaticTarget !== null) {
        state.currentIndex += (state.programmaticTarget - state.currentIndex) * 0.14;
        if (Math.abs(state.programmaticTarget - state.currentIndex) < 0.002) {
          state.currentIndex = state.programmaticTarget;
          state.programmaticTarget = null;
        }
      } else if (!state.isDragging) {
        state.currentIndex += state.velocity;
        state.velocity *= 0.88;

        if (state.currentIndex < 0) {
          state.currentIndex += (0 - state.currentIndex) * 0.18;
          state.velocity = 0;
        } else if (state.currentIndex > itemCount - 1) {
          state.currentIndex += (itemCount - 1 - state.currentIndex) * 0.18;
          state.velocity = 0;
        }

        if (Math.abs(state.velocity) < 0.0018) {
          const nearest = Math.round(state.currentIndex);
          state.currentIndex += (nearest - state.currentIndex) * 0.12;
        }
      }

      // ================= 10 DISTINCT 3D LAYOUT POSITIONS =================
      cardGroups.forEach((cardMesh) => {
        const slot = cardMesh.userData.index;
        const offset = slot - state.currentIndex;

        switch (album.layoutType) {
          // Layout 1: Shallow Orbital Arc (Album 1: Bandhobis)
          case 'shallow-arc': {
            const theta = offset * 0.29;
            const r = 5.8;
            cardMesh.position.set(r * Math.sin(theta), 0, r * (Math.cos(theta) - 1));
            cardMesh.rotation.set(0, theta * 0.86, 0);
            const scale = 0.88 + 0.32 * Math.pow(Math.max(0, Math.cos(theta)), 2.8);
            cardMesh.scale.set(scale, scale, scale);
            if (Math.abs(offset) < 0.3) {
              cardMesh.position.y = Math.sin(elapsedTime * 1.8) * 0.045;
            }
            break;
          }

          // Layout 2: Depth Cascade (Album 2: Works)
          case 'depth-cascade': {
            const x = offset * 1.7;
            const y = -offset * 0.45;
            const z = -Math.abs(offset) * 1.6;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(0.12, -0.22 * Math.sign(offset || 1), 0);
            const scale = 0.92 + 0.28 * Math.max(0, 1 - Math.abs(offset) * 0.4);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 3: Horizontal Ribbon Slider (Album 3: H2026 Photos)
          case 'ribbon-slider': {
            const x = offset * 2.35;
            const y = Math.sin(offset * 0.8) * 0.28;
            const z = -Math.pow(offset, 2) * 0.12;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(0, offset * 0.08, 0);
            const scale = 0.9 + 0.28 * Math.max(0, 1 - Math.abs(offset) * 0.35);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 4: Showcase Spotlight Hero (Album 4: H2025 Photos)
          case 'showcase-hero': {
            if (Math.abs(offset) < 0.5) {
              cardMesh.position.set(0, 0, 0.4);
              cardMesh.rotation.set(0, 0, 0);
              cardMesh.scale.set(1.3, 1.3, 1.3);
            } else {
              const sign = Math.sign(offset);
              const rank = Math.abs(offset);
              cardMesh.position.set(sign * (1.6 + rank * 1.4), 0, -rank * 1.1);
              cardMesh.rotation.set(0, -sign * 0.42, 0);
              cardMesh.scale.set(0.85, 0.85, 0.85);
            }
            break;
          }

          // Layout 5: 3D Grid Wall with Tilt (Album 5: Classic)
          case 'grid-wall': {
            const col = slot % 3;
            const row = Math.floor(slot / 3);
            const x = (col - 1) * 2.5;
            const y = row === 0 ? 1.6 : -1.6;
            const isFocus = Math.abs(offset) < 0.5;
            const z = isFocus ? 0.6 : 0;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(
              state.mousePos.y * 0.12,
              state.mousePos.x * 0.12,
              0
            );
            const scale = isFocus ? 1.15 : 0.95;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 6: Cinematic Cylinder Theater (Album 6: Favorite Videos)
          case 'theater-cylinder': {
            const theta = offset * 0.38;
            const r = 6.4;
            cardMesh.position.set(r * Math.sin(theta), 0, r * (Math.cos(theta) - 1));
            cardMesh.rotation.set(0, theta * 0.9, 0);
            const scale = 0.88 + 0.3 * Math.pow(Math.max(0, Math.cos(theta)), 2.5);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 7: Spiral Helix Orbit (Album 7: H2026 Videos)
          case 'spiral-helix': {
            const angle = offset * 0.45;
            const r = 4.6;
            cardMesh.position.set(
              r * Math.sin(angle),
              offset * 0.65,
              r * (Math.cos(angle) - 1)
            );
            cardMesh.rotation.set(0.08, angle * 0.85, 0.05);
            const scale = 0.85 + 0.3 * Math.max(0, 1 - Math.abs(offset) * 0.3);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 8: Perspective Tunnel (Album 8: H2025 Videos)
          case 'perspective-tunnel': {
            const side = slot % 2 === 0 ? -1 : 1;
            const dist = Math.floor(slot / 2);
            const x = side * 2.8;
            const z = -dist * 2.6 + state.currentIndex * 1.3;
            cardMesh.position.set(x, 0, z);
            cardMesh.rotation.set(0, -side * 0.38, 0);
            const scale = 0.95;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 9: Panoramic Amphitheater (Album 9: Others Videos)
          case 'curved-billboard': {
            const theta = offset * 0.34;
            const r = 7.0;
            cardMesh.position.set(r * Math.sin(theta), 0, r * (Math.cos(theta) - 1));
            cardMesh.rotation.set(0, theta * 0.95, 0);
            const scale = 0.9 + 0.28 * Math.max(0, Math.cos(theta));
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 10: Tiered Waterfall Card Fan (Album 10: Shorts)
          case 'vertical-waterfall':
          default: {
            const x = offset * 1.5;
            const z = -Math.abs(offset) * 0.8;
            const rotZ = -offset * 0.08;
            cardMesh.position.set(x, 0, z);
            cardMesh.rotation.set(0, offset * 0.12, rotZ);
            const scale = 0.88 + 0.32 * Math.max(0, 1 - Math.abs(offset) * 0.35);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }
        }
      });

      const activeCalculated = Math.round(
        Math.max(0, Math.min(itemCount - 1, state.currentIndex))
      );
      if (activeCalculated !== lastNotified) {
        lastNotified = activeCalculated;
        onActiveIndexChangeRef.current(activeCalculated);
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
