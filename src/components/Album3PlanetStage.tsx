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

interface Album3PlanetStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
}

// Particle sprite texture with soft radial glow
function createPlanetParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(120, 230, 255, 0.9)');
  grad.addColorStop(0.55, 'rgba(0, 180, 255, 0.45)');
  grad.addColorStop(0.85, 'rgba(255, 170, 0, 0.15)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
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

export const Album3PlanetStage: React.FC<Album3PlanetStageProps> = ({
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

  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
    onActiveIndexChangeRef.current = onActiveIndexChange;
  }, [onSelectItem, onActiveIndexChange]);

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

    const items = album.items || [];
    const totalItems = items.length;
    if (totalItems === 0) return;

    // Display a page of items based on batch
    const startIdx = batchIndex * 6;
    const stageItems = items.slice(startIdx, startIdx + 6);
    const itemCount = Math.max(1, stageItems.length);

    // --- 1. THREE.JS SCENE & PERSPECTIVE CAMERA ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000208);
    scene.fog = new THREE.FogExp2(0x00030a, 0.024);

    const isPortrait = window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, isPortrait ? 9.6 : 8.0);
    camera.lookAt(0, 0, 0);

    // --- 2. WEBER-GRADE RENDERER ---
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const topKey = new THREE.SpotLight(0xffffff, 5.0, 24, Math.PI / 4, 0.5, 1.2);
    topKey.position.set(-1.0, 5.5, 3.5);
    scene.add(topKey);

    // Electric cyan planet rim light
    const cyanLimbLight = new THREE.PointLight(0x00d2ff, 5.5, 18);
    cyanLimbLight.position.set(5.5, 1.2, 1.2);
    scene.add(cyanLimbLight);

    // Warm amber sunset rim highlight
    const amberRimLight = new THREE.PointLight(0xff9900, 3.8, 14);
    amberRimLight.position.set(3.8, 2.8, 1.5);
    scene.add(amberRimLight);

    // Mouse reactive specular point
    const mouseReactiveLight = new THREE.PointLight(0x00d2ff, 2.8, 16);
    mouseReactiveLight.position.set(0, 0, 3.8);
    scene.add(mouseReactiveLight);

    // --- 4. UNITEDCARRIERS 3D ROTATING PARTICLE GLOBE (RIGHT HEMISPHERE) ---
    const globeRootGroup = new THREE.Group();
    // Positioned gracefully in the right hemisphere of the viewport
    globeRootGroup.position.set(isPortrait ? 1.8 : 3.4, isPortrait ? -0.8 : 0.0, -1.2);
    scene.add(globeRootGroup);

    // Polar axial tilt (~23.5 degrees)
    const globeTiltGroup = new THREE.Group();
    globeTiltGroup.rotation.z = -0.38;
    globeRootGroup.add(globeTiltGroup);

    // Spinning group
    const globeSpinGroup = new THREE.Group();
    globeTiltGroup.add(globeSpinGroup);

    // Point-cloud Matrix Sphere (Fibonacci distribution)
    const GLOBE_POINTS = 3800;
    const GLOBE_RADIUS = 2.45;
    const globeGeo = new THREE.BufferGeometry();
    const globePositions = new Float32Array(GLOBE_POINTS * 3);
    const globeColors = new Float32Array(GLOBE_POINTS * 3);
    const surfacePoints: THREE.Vector3[] = [];

    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < GLOBE_POINTS; i++) {
      const y = 1 - (i / (GLOBE_POINTS - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const px = x * GLOBE_RADIUS;
      const py = y * GLOBE_RADIUS;
      const pz = z * GLOBE_RADIUS;

      globePositions[i * 3] = px;
      globePositions[i * 3 + 1] = py;
      globePositions[i * 3 + 2] = pz;

      surfacePoints.push(new THREE.Vector3(px, py, pz));

      // Electric cyan base with amber accents on the illuminated limb
      const isLimbAccent = x > 0.15 && Math.random() > 0.72;
      if (isLimbAccent) {
        globeColors[i * 3] = 1.0;
        globeColors[i * 3 + 1] = 0.65;
        globeColors[i * 3 + 2] = 0.12;
      } else {
        globeColors[i * 3] = 0.0;
        globeColors[i * 3 + 1] = 0.78 + Math.random() * 0.22;
        globeColors[i * 3 + 2] = 1.0;
      }
    }

    globeGeo.setAttribute('position', new THREE.BufferAttribute(globePositions, 3));
    globeGeo.setAttribute('color', new THREE.BufferAttribute(globeColors, 3));

    const planetParticleTex = createPlanetParticleTexture();
    const globePointsMat = new THREE.PointsMaterial({
      size: 0.075,
      map: planetParticleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const globePointsMesh = new THREE.Points(globeGeo, globePointsMat);
    globeSpinGroup.add(globePointsMesh);

    // Atmospheric Corona / Fresnel Outer Glow Shell
    const coronaGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 48, 48);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    globeSpinGroup.add(coronaMesh);

    // Outer Limb Glowing Disc
    const haloDiscGeo = new THREE.RingGeometry(GLOBE_RADIUS * 0.98, GLOBE_RADIUS * 1.14, 64);
    const haloDiscMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haloDiscMesh = new THREE.Mesh(haloDiscGeo, haloDiscMat);
    haloDiscMesh.rotation.y = Math.PI / 2;
    globeRootGroup.add(haloDiscMesh);

    // Micro Details: Pulsing Orbital Arc Lines
    const ARC_COUNT = 14;
    const arcLines: THREE.Line[] = [];
    const arcMaterials: THREE.LineBasicMaterial[] = [];
    const orbitNodes: THREE.Mesh[] = [];

    for (let a = 0; a < ARC_COUNT; a++) {
      const p1 = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];
      const p2 = surfacePoints[Math.floor(Math.random() * surfacePoints.length)];

      if (p1 && p2 && p1.distanceTo(p2) > 1.2) {
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        // Elevate midpoint above the globe surface
        const elevatedMid = mid.clone().normalize().multiplyScalar(GLOBE_RADIUS + 0.25 + Math.random() * 0.35);

        const curve = new THREE.CatmullRomCurve3([p1, elevatedMid, p2]);
        const curvePoints = curve.getPoints(36);
        const arcGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);

        const arcMat = new THREE.LineBasicMaterial({
          color: a % 3 === 0 ? 0xffaa00 : 0x00d2ff,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });

        const arcLine = new THREE.Line(arcGeo, arcMat);
        globeSpinGroup.add(arcLine);
        arcLines.push(arcLine);
        arcMaterials.push(arcMat);

        // Orbit node dot traveling on curve
        const nodeGeo = new THREE.SphereGeometry(0.035, 12, 12);
        const nodeMat = new THREE.MeshBasicMaterial({
          color: a % 3 === 0 ? 0xffdd44 : 0x00ffff,
          blending: THREE.AdditiveBlending,
        });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        globeSpinGroup.add(nodeMesh);
        nodeMesh.userData = { curve, speed: 0.15 + Math.random() * 0.2, phase: Math.random() };
        orbitNodes.push(nodeMesh);
      }
    }

    // --- 5. FOREGROUND ALBUM 3 PHOTO CAROUSEL (CENTER-LEFT POSITIONED) ---
    const rootCardsGroup = new THREE.Group();
    // Offset slightly to the left so the UnitedCarriers planet stays visible on the right
    rootCardsGroup.position.set(isPortrait ? 0 : -0.9, 0, 0);
    scene.add(rootCardsGroup);

    const cardWidth = 2.45;
    const cardHeight = 3.35;
    const cardDepth = 0.08;
    const photoWidth = cardWidth - 0.12;
    const photoHeight = cardHeight - 0.12;

    const chassisGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      metalness: 0.94,
      roughness: 0.25,
    });

    const outerShape = createRoundedRectShape(cardWidth, cardHeight, 0.08);
    const innerHole = createRoundedRectShape(photoWidth, photoHeight, 0.03);
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
      color: 0xeef4ff,
      metalness: 0.96,
      roughness: 0.12,
      clearcoat: 1.0,
      reflectivity: 0.95,
    });

    const photoPlaneGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);
    const backplateGeo = new THREE.PlaneGeometry(cardWidth - 0.03, cardHeight - 0.03);
    const backplateMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      metalness: 0.95,
      roughness: 0.25,
    });

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const cardMeshes: THREE.Group[] = [];

    stageItems.forEach((item, index) => {
      const cardGroup = new THREE.Group();
      cardGroup.userData = { index, item };

      const fallbackTex = createProceduralFrameTexture({
        title: item.title,
        category: item.category || album.name,
        index: startIdx + index,
        total: album.itemCount,
      });

      const photoMat = new THREE.MeshBasicMaterial({
        map: fallbackTex,
        color: 0xffffff,
        side: THREE.FrontSide,
        toneMapped: true,
      });

      const primaryUrl = getDirectImageUrl(item, startIdx + index);
      const fileId = extractDriveFileId(item.id, item.url, item.thumbnail);
      const backupUrl = fileId ? getBackupDriveUrl(fileId) : primaryUrl;
      const unsplashUrl = getUnsplashFallback(startIdx + index);

      textureLoader.load(
        primaryUrl,
        (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          photoMat.map = loadedTex;
          photoMat.needsUpdate = true;
        },
        undefined,
        () => {
          textureLoader.load(
            backupUrl,
            (backupTex) => {
              backupTex.colorSpace = THREE.SRGBColorSpace;
              backupTex.generateMipmaps = true;
              photoMat.map = backupTex;
              photoMat.needsUpdate = true;
            },
            undefined,
            () => {
              textureLoader.load(
                unsplashUrl,
                (unsplashTex) => {
                  unsplashTex.colorSpace = THREE.SRGBColorSpace;
                  unsplashTex.generateMipmaps = true;
                  photoMat.map = unsplashTex;
                  photoMat.needsUpdate = true;
                },
                undefined,
                () => {}
              );
            }
          );
        }
      );

      const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
      cardGroup.add(chassisMesh);

      const borderMesh = new THREE.Mesh(bevelBorderGeo, metallicBorderMat);
      borderMesh.position.z = cardDepth / 2 + 0.01;
      cardGroup.add(borderMesh);

      const photoMesh = new THREE.Mesh(photoPlaneGeo, photoMat);
      photoMesh.position.z = cardDepth / 2 + 0.032;
      photoMesh.renderOrder = 2;
      cardGroup.add(photoMesh);

      const backMesh = new THREE.Mesh(backplateGeo, backplateMat);
      backMesh.position.z = -cardDepth / 2 - 0.001;
      backMesh.rotation.y = Math.PI;
      cardGroup.add(backMesh);

      rootCardsGroup.add(cardGroup);
      cardMeshes.push(cardGroup);
    });

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
      const intersects = raycaster.intersectObjects(rootCardsGroup.children, true);

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

      if (!didDragSignificantly) {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(rootCardsGroup.children, true);

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
      camera.position.z = portraitNow ? 9.6 : 8.0;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);

      globeRootGroup.position.set(portraitNow ? 1.8 : 3.4, portraitNow ? -0.8 : 0.0, -1.2);
      rootCardsGroup.position.set(portraitNow ? 0 : -0.9, 0, 0);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    // --- 7. ANIMATION LOOP ---
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let lastNotified = activeIndex;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const state = animStateRef.current;

      // Slowly rotate UnitedCarriers 3D Digital Planet
      globeSpinGroup.rotation.y += 0.0035;

      // Pulse orbital lines gently
      arcMaterials.forEach((mat, idx) => {
        mat.opacity = 0.22 + 0.18 * Math.sin(elapsedTime * 2.2 + idx);
      });

      // Animate orbit data nodes
      orbitNodes.forEach((node) => {
        const { curve, speed, phase } = node.userData;
        const progress = (phase + elapsedTime * speed) % 1;
        const pos = curve.getPointAt(progress);
        node.position.copy(pos);
      });

      // Gentle mouse parallax on the planet
      globeRootGroup.position.x +=
        ((isPortrait ? 1.8 : 3.4) + state.mousePos.x * 0.28 - globeRootGroup.position.x) * 0.06;
      globeRootGroup.position.y +=
        ((isPortrait ? -0.8 : 0.0) + state.mousePos.y * 0.22 - globeRootGroup.position.y) * 0.06;

      // Atmospheric specular point reacts to cursor
      mouseReactiveLight.position.x += (state.mousePos.x * 5.2 - mouseReactiveLight.position.x) * 0.08;
      mouseReactiveLight.position.y += (state.mousePos.y * 3.6 - mouseReactiveLight.position.y) * 0.08;

      // Card Physics & Auto-Snap
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

      // Position foreground photo cards
      cardMeshes.forEach((cardMesh) => {
        const slot = cardMesh.userData.index;
        const offset = slot - state.currentIndex;
        const isHovered = slot === state.hoveredIndex;

        const hoverZLift = isHovered ? 0.35 : 0;
        const hoverTiltX = isHovered ? -state.mousePos.y * 0.12 : 0;
        const hoverTiltY = isHovered ? state.mousePos.x * 0.12 : 0;

        // Curved horizontal ribbon arc centered left of the planet
        const theta = offset * 0.38;
        const r = 6.4;
        const x = r * Math.sin(theta);
        const z = r * (Math.cos(theta) - 1) + hoverZLift;

        cardMesh.position.set(x, 0, z);
        cardMesh.rotation.set(hoverTiltX, theta * 0.82 + hoverTiltY, 0);

        const scaleBoost = Math.max(0, Math.cos(theta));
        const baseScale = 0.88 + 0.32 * Math.pow(scaleBoost, 2.8);
        const finalScale = isHovered ? baseScale * 1.08 : baseScale;
        cardMesh.scale.set(finalScale, finalScale, finalScale);
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

    // --- 8. CLEANUP & MEMORY DISPOSAL ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);

      globeGeo.dispose();
      globePointsMat.dispose();
      coronaGeo.dispose();
      coronaMat.dispose();
      haloDiscGeo.dispose();
      haloDiscMat.dispose();
      planetParticleTex.dispose();

      arcLines.forEach((line) => line.geometry.dispose());
      arcMaterials.forEach((mat) => mat.dispose());

      chassisGeo.dispose();
      chassisMat.dispose();
      bevelBorderGeo.dispose();
      metallicBorderMat.dispose();
      photoPlaneGeo.dispose();
      backplateGeo.dispose();
      backplateMat.dispose();

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
