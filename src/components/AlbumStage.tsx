/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createProceduralFrameTexture, createComingSoonTexture } from '../utils/textureGenerator';
import { WeichieMarqueeStage } from './WeichieMarqueeStage';
import type { AlbumData, StageMediaItem } from '../types';

interface AlbumStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
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

const StandardAlbumStage: React.FC<AlbumStageProps> = ({
  album,
  isActive,
  onSelectItem,
  activeIndex,
  onActiveIndexChange,
  batchIndex,
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
    hoveredIndex: -1,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');
    // Display 5 to 6 items per batch
    const startIdx = batchIndex * 6;
    const stageItems = isComingSoon ? [] : album.items.slice(startIdx, startIdx + 6);
    const itemCount = isComingSoon ? 1 : Math.max(1, stageItems.length);

    // --- 1. SCENE & CAMERA (PERFECT OPTICAL CENTERING) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000208, 0.032);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Camera is perfectly centered at X = 0, Y = 0
    camera.position.set(0, 0, isPortrait ? 9.4 : 7.6);
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

    // --- 3. ATMOSPHERIC DEEP SPACE VOID LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0x182035, 1.8);
    scene.add(ambientLight);

    // Center Top Key Spotlight
    const topSpotLight = new THREE.SpotLight(0xffffff, 6.5, 26, Math.PI / 4.0, 0.55, 1.2);
    topSpotLight.position.set(0, 5.5, 3.2);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 0);
    scene.add(spotTarget);
    topSpotLight.target = spotTarget;
    scene.add(topSpotLight);

    // Front soft key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(0, 2.5, 6);
    scene.add(keyLight);

    // Layout color themes
    let primaryColor = 0x00d2ff; // Cyan
    let secondaryColor = 0x3b82f6; // Blue

    switch (album.layoutType) {
      case 'depth-cascade':
        primaryColor = 0x9d00ff;
        secondaryColor = 0x00d2ff;
        break;
      case 'ribbon-slider':
        primaryColor = 0x00f5a0;
        secondaryColor = 0x0072ff;
        break;
      case 'showcase-hero':
        primaryColor = 0xffffff;
        secondaryColor = 0x00d2ff;
        break;
      case 'grid-wall':
        primaryColor = 0xffaa00;
        secondaryColor = 0x3b82f6;
        break;
      case 'theater-cylinder':
        primaryColor = 0xff007a;
        secondaryColor = 0x00d2ff;
        break;
      case 'spiral-helix':
        primaryColor = 0x00e5ff;
        secondaryColor = 0x7000ff;
        break;
      case 'perspective-tunnel':
        primaryColor = 0x00ffcc;
        secondaryColor = 0xff0055;
        break;
      case 'vertical-waterfall':
        primaryColor = 0xff00aa;
        secondaryColor = 0x00d2ff;
        break;
    }

    const leftRimLight = new THREE.PointLight(primaryColor, 3.8, 22);
    leftRimLight.position.set(-5.5, 1.5, 2.0);
    scene.add(leftRimLight);

    const rightRimLight = new THREE.PointLight(secondaryColor, 3.8, 22);
    rightRimLight.position.set(5.5, 1.5, 2.0);
    scene.add(rightRimLight);

    // Subtle mouse-reactive ambient glow light in space
    const mouseReactiveLight = new THREE.PointLight(0x00d2ff, 2.8, 16);
    mouseReactiveLight.position.set(0, 0, 3.5);
    scene.add(mouseReactiveLight);

    // --- 4. 3D GEOMETRY ROOT (CENTERED ACROSS VIEWPORT) ---
    const rootGroup = new THREE.Group();
    rootGroup.position.set(0, 0, 0);
    scene.add(rootGroup);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const cardGroups: THREE.Group[] = [];
    let comingSoonCoreMesh: THREE.Object3D | null = null;

    if (isComingSoon) {
      // ================= ULTRA-CLEAN COMING SOON 3D STAGE =================
      const csGroup = new THREE.Group();
      rootGroup.add(csGroup);

      if (album.layoutType === 'coming-soon-photos') {
        const octaGeo = new THREE.OctahedronGeometry(1.4, 0);
        const octaMat = new THREE.MeshPhysicalMaterial({
          color: 0x00d2ff,
          metalness: 0.15,
          roughness: 0.08,
          transmission: 0.88,
          thickness: 1.2,
          clearcoat: 1.0,
        });
        const crystalMesh = new THREE.Mesh(octaGeo, octaMat);
        csGroup.add(crystalMesh);

        const wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const wireMesh = new THREE.Mesh(octaGeo, wireMat);
        wireMesh.scale.setScalar(1.02);
        crystalMesh.add(wireMesh);

        comingSoonCoreMesh = crystalMesh;
      } else {
        const sphereGeo = new THREE.IcosahedronGeometry(1.25, 2);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: 0x080f1c,
          emissive: 0x0055ff,
          emissiveIntensity: 0.5,
          metalness: 0.95,
          roughness: 0.15,
        });
        const vaultSphere = new THREE.Mesh(sphereGeo, sphereMat);
        csGroup.add(vaultSphere);

        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, wireframe: true });
        const wireMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), wireMat);
        vaultSphere.add(wireMesh);

        comingSoonCoreMesh = vaultSphere;
      }

      // Elegant Holographic Badge Plane
      const csBadgeTex = createComingSoonTexture(album.name, album.subtitle || '2027 ARCHIVE');
      const csBadgeMat = new THREE.MeshBasicMaterial({
        map: csBadgeTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const csBadge = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), csBadgeMat);
      csBadge.position.set(0, 0, 0.2);
      csGroup.add(csBadge);
    } else {
      // ================= 10 DISTINCT MEDIA STAGE DESIGNS =================
      const isVideoType = album.type === 'video';
      const isShorts = album.layoutType === 'vertical-waterfall';

      // Proportions: 3:4 portrait or 16:9 video or 9:16 shorts
      const cardWidth = isShorts ? 1.85 : isVideoType ? 3.0 : 2.15;
      const cardHeight = isShorts ? 3.2 : isVideoType ? 1.8 : 3.05;
      const cardDepth = 0.07;
      const photoWidth = cardWidth - 0.14;
      const photoHeight = cardHeight - 0.14;

      const chassisGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x0e111a,
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
        clearcoat: 0.9,
      });

      const photoPlaneGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

      const backplateGeo = new THREE.PlaneGeometry(cardWidth - 0.03, cardHeight - 0.03);
      const backplateMat = new THREE.MeshStandardMaterial({
        color: 0x05070c,
        metalness: 0.95,
        roughness: 0.25,
      });

      stageItems.forEach((item, index) => {
        const cardGroup = new THREE.Group();
        cardGroup.userData = { index, item };

        const fallbackTex = createProceduralFrameTexture({
          title: item.title,
          category: item.category || album.name,
          index: startIdx + index,
          total: album.itemCount,
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

      // Raycast for hover focus & specular highlight
      pointer.x = animStateRef.current.mousePos.x;
      pointer.y = animStateRef.current.mousePos.y;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(rootGroup.children, true);

      if (intersects.length > 0) {
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && hit.userData?.index === undefined) {
          hit = hit.parent;
        }
        if (hit && hit.userData) {
          animStateRef.current.hoveredIndex = hit.userData.index;
        }
      } else {
        animStateRef.current.hoveredIndex = -1;
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
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        animStateRef.current.velocity += e.deltaX * 0.0004;
        animStateRef.current.programmaticTarget = null;
      }
    };

    const onResize = () => {
      const portraitNow = window.innerWidth < 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.position.z = portraitNow ? 9.4 : 7.6;
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

      // Mouse reactive atmospheric glow
      mouseReactiveLight.position.x += (state.mousePos.x * 5.2 - mouseReactiveLight.position.x) * 0.08;
      mouseReactiveLight.position.y += (state.mousePos.y * 3.6 - mouseReactiveLight.position.y) * 0.08;

      if (isComingSoon) {
        if (comingSoonCoreMesh) {
          comingSoonCoreMesh.rotation.y = elapsedTime * 0.55;
          comingSoonCoreMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.18;
          comingSoonCoreMesh.position.y = Math.sin(elapsedTime * 2.0) * 0.06;
        }
        renderer.render(scene, camera);
        return;
      }

      // Drag physics & auto-snap
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

      // ================= CENTERED 3D LAYOUTS WITH CLEAN GAPS =================
      cardGroups.forEach((cardMesh) => {
        const slot = cardMesh.userData.index;
        const offset = slot - state.currentIndex;
        const isHovered = slot === state.hoveredIndex;

        // Hover depth lift & tilt
        const hoverZLift = isHovered ? 0.35 : 0;
        const hoverTiltX = isHovered ? -state.mousePos.y * 0.12 : 0;
        const hoverTiltY = isHovered ? state.mousePos.x * 0.12 : 0;

        switch (album.layoutType) {
          // Layout 1: Shallow Orbital Arc (Album 1: Bandhobis)
          // Wide angular spacing (0.40 rad) guarantees clean gaps and zero overlapping
          case 'shallow-arc': {
            const theta = offset * 0.40;
            const r = 6.2;
            const x = r * Math.sin(theta);
            const z = r * (Math.cos(theta) - 1) + hoverZLift;
            cardMesh.position.set(x, 0, z);
            cardMesh.rotation.set(hoverTiltX, theta * 0.82 + hoverTiltY, 0);

            const scaleBoost = Math.max(0, Math.cos(theta));
            const baseScale = 0.88 + 0.32 * Math.pow(scaleBoost, 2.8);
            const finalScale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(finalScale, finalScale, finalScale);

            if (Math.abs(offset) < 0.28 && !isHovered) {
              cardMesh.position.y = Math.sin(elapsedTime * 1.8) * 0.045;
            }
            break;
          }

          // Layout 2: Depth Cascade (Album 2: Works)
          case 'depth-cascade': {
            const x = offset * 2.5;
            const y = -offset * 0.38;
            const z = -Math.abs(offset) * 1.7 + hoverZLift;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(0.1 + hoverTiltX, -0.22 * Math.sign(offset || 1) + hoverTiltY, 0);
            const baseScale = 0.9 + 0.28 * Math.max(0, 1 - Math.abs(offset) * 0.35);
            const finalScale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(finalScale, finalScale, finalScale);
            break;
          }

          // Layout 3: Horizontal Ribbon Slider (Album 3: H2026 Photos)
          case 'ribbon-slider': {
            const x = offset * 2.65; // Wide spacing prevents collision
            const y = Math.sin(offset * 0.7) * 0.24;
            const z = -Math.pow(offset, 2) * 0.14 + hoverZLift;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(hoverTiltX, offset * 0.08 + hoverTiltY, 0);
            const baseScale = 0.9 + 0.28 * Math.max(0, 1 - Math.abs(offset) * 0.35);
            const finalScale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(finalScale, finalScale, finalScale);
            break;
          }

          // Layout 4: Showcase Hero (Album 4: H2025 Photos)
          case 'showcase-hero': {
            if (Math.abs(offset) < 0.5) {
              cardMesh.position.set(0, 0, 0.4 + hoverZLift);
              cardMesh.rotation.set(hoverTiltX, hoverTiltY, 0);
              const scale = isHovered ? 1.38 : 1.3;
              cardMesh.scale.set(scale, scale, scale);
            } else {
              const sign = Math.sign(offset);
              const rank = Math.abs(offset);
              cardMesh.position.set(sign * (1.9 + rank * 1.7), 0, -rank * 1.2 + hoverZLift);
              cardMesh.rotation.set(hoverTiltX, -sign * 0.42 + hoverTiltY, 0);
              const scale = isHovered ? 0.92 : 0.85;
              cardMesh.scale.set(scale, scale, scale);
            }
            break;
          }

          // Layout 5: 3D Grid Wall with Hover Tilt (Album 5: Classic)
          case 'grid-wall': {
            const col = slot % 3;
            const row = Math.floor(slot / 3);
            const x = (col - 1) * 2.65;
            const y = row === 0 ? 1.65 : -1.65;
            const isFocus = Math.abs(offset) < 0.5;
            const z = (isFocus ? 0.6 : 0) + hoverZLift;
            cardMesh.position.set(x, y, z);
            cardMesh.rotation.set(
              state.mousePos.y * 0.12 + hoverTiltX,
              state.mousePos.x * 0.12 + hoverTiltY,
              0
            );
            const scale = (isFocus ? 1.15 : 0.95) * (isHovered ? 1.08 : 1.0);
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 6: Cinema Cylinder Theater (Album 6: Favorite Videos)
          case 'theater-cylinder': {
            const theta = offset * 0.42;
            const r = 6.8;
            cardMesh.position.set(r * Math.sin(theta), 0, r * (Math.cos(theta) - 1) + hoverZLift);
            cardMesh.rotation.set(hoverTiltX, theta * 0.88 + hoverTiltY, 0);
            const baseScale = 0.88 + 0.3 * Math.pow(Math.max(0, Math.cos(theta)), 2.5);
            const scale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 7: Spiral Helix Orbit (Album 7: H2026 Videos)
          case 'spiral-helix': {
            const angle = offset * 0.48;
            const r = 5.0;
            cardMesh.position.set(
              r * Math.sin(angle),
              offset * 0.65,
              r * (Math.cos(angle) - 1) + hoverZLift
            );
            cardMesh.rotation.set(0.08 + hoverTiltX, angle * 0.85 + hoverTiltY, 0.05);
            const baseScale = 0.85 + 0.3 * Math.max(0, 1 - Math.abs(offset) * 0.3);
            const scale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 8: Perspective Corridor (Album 8: H2025 Videos)
          case 'perspective-tunnel': {
            const side = slot % 2 === 0 ? -1 : 1;
            const dist = Math.floor(slot / 2);
            const x = side * 3.2; // Clean hallway width
            const z = -dist * 2.8 + state.currentIndex * 1.4 + hoverZLift;
            cardMesh.position.set(x, 0, z);
            cardMesh.rotation.set(hoverTiltX, -side * 0.36 + hoverTiltY, 0);
            const scale = isHovered ? 1.05 : 0.95;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 9: Panoramic Amphitheater (Album 9: Others Videos)
          case 'curved-billboard': {
            const theta = offset * 0.40;
            const r = 7.4;
            cardMesh.position.set(r * Math.sin(theta), 0, r * (Math.cos(theta) - 1) + hoverZLift);
            cardMesh.rotation.set(hoverTiltX, theta * 0.9 + hoverTiltY, 0);
            const baseScale = 0.9 + 0.28 * Math.max(0, Math.cos(theta));
            const scale = isHovered ? baseScale * 1.08 : baseScale;
            cardMesh.scale.set(scale, scale, scale);
            break;
          }

          // Layout 10: Tiered Waterfall Card Fan (Album 10: Shorts & Reels)
          case 'vertical-waterfall':
          default: {
            const x = offset * 1.95; // Wide spacing preventing overlap
            const z = -Math.abs(offset) * 0.95 + hoverZLift;
            const rotZ = -offset * 0.06;
            cardMesh.position.set(x, 0, z);
            cardMesh.rotation.set(hoverTiltX, offset * 0.12 + hoverTiltY, rotZ);
            const baseScale = 0.88 + 0.32 * Math.max(0, 1 - Math.abs(offset) * 0.35);
            const scale = isHovered ? baseScale * 1.08 : baseScale;
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
  }, [isActive, album, batchIndex]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing bg-black z-0"
    />
  );
};

export const AlbumStage: React.FC<AlbumStageProps> = (props) => {
  if (props.album.layoutType === 'weichie-curved' || props.album.index === 0) {
    return <WeichieMarqueeStage {...props} />;
  }
  return <StandardAlbumStage {...props} />;
};
