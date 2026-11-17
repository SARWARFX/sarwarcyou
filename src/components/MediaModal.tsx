import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Check,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';

import { unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticMedium } from '../utils/hapticsManager';
import { getMediaShortId, updateBrowserUrl } from '../utils/urlRouter';
import { HeaderBrandLogo } from './updater/HeaderBrandLogo';
import {
  LaserCloseIcon,
  LaserPrevIcon,
  LaserNextIcon,
  LaserDownloadIcon,
  LaserZoomInIcon,
  LaserZoomOutIcon,
} from './brand/LaserIcons';
import type { StageMediaItem, MediaFolderEntry } from '../types';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: 'video' | 'image';
  title?: string;
  items?: StageMediaItem[];
  currentIndex?: number;
  onIndexChange?: (newIndex: number) => void;
  allFolders?: MediaFolderEntry[];
  onSelectFolder?: (folder: MediaFolderEntry) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  onClose,
  url,
  type,
  title,
  items = [],
  currentIndex: propCurrentIndex = 0,
  onIndexChange: _onIndexChange,
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(propCurrentIndex);
  const [scale, setScale] = useState<number>(1);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [animationClass, setAnimationClass] = useState<string>('animate-picasa-open');

  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastGestureTimeRef = useRef<number>(0);
  const lastDoubleTapTimeRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [showControls, setShowControls] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      // Tray does not view upon opening photo; only appears on single tap on image
      setShowControls(false);
    }
  }, [isOpen, activeIdx]);

  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseDimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const resetZoom = useCallback(() => {
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setPos({ x: 0, y: 0 });
    setIsTransitioning(true);
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      imgRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      setTimeout(() => {
        if (imgRef.current) imgRef.current.style.transition = 'none';
        setIsTransitioning(false);
      }, 250);
    }
  }, []);

  const goToNext = useCallback(() => {
    if (items && items.length > 0 && activeIdx < items.length - 1) {
      const next = activeIdx + 1;
      setAnimationClass('animate-photo-slide-next');
      setActiveIdx(next);
      _onIndexChange?.(next);
      resetZoom();
      if (items[next]) {
        updateBrowserUrl('/photographs/' + getMediaShortId(items[next]), true);
      }
    }
  }, [items, activeIdx, _onIndexChange, resetZoom]);

  const goToPrev = useCallback(() => {
    if (items && items.length > 0 && activeIdx > 0) {
      const prev = activeIdx - 1;
      setAnimationClass('animate-photo-slide-prev');
      setActiveIdx(prev);
      _onIndexChange?.(prev);
      resetZoom();
      if (items[prev]) {
        updateBrowserUrl('/photographs/' + getMediaShortId(items[prev]), true);
      }
    }
  }, [items, activeIdx, _onIndexChange, resetZoom]);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  const [prevPropKey, setPrevPropKey] = useState({ propCurrentIndex, isOpen });
  if (prevPropKey.propCurrentIndex !== propCurrentIndex || prevPropKey.isOpen !== isOpen) {
    setPrevPropKey({ propCurrentIndex, isOpen });
    setActiveIdx(propCurrentIndex);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setPos({ x: 0, y: 0 });
    if (isOpen) {
      setAnimationClass('animate-picasa-open');
    }
  }

  // Determine active media item
  const hasItemList = items && items.length > 0;
  const currentItem = hasItemList ? items[activeIdx] : null;
  const activeUrl = currentItem?.url || url;
  const activeTitle = currentItem?.title || title || (type === 'video' ? 'Video Stream' : 'Photograph');

  // Reset whenever displayed photo changes
  useEffect(() => {
    resetZoom();
  }, [activeIdx, activeUrl, resetZoom]);

  // Keep browser address bar in sync with active photograph
  useEffect(() => {
    if (isOpen && currentItem) {
      updateBrowserUrl('/photographs/' + getMediaShortId(currentItem), true);
    }
  }, [isOpen, activeIdx, currentItem]);

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      if (scaleRef.current > 1.05) {
        resetZoom();
        return true;
      }
      unlockOrientation();
      onClose();
      return true;
    }, [resetZoom, onClose]),
    isOpen
  );

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, goToNext, goToPrev]);

  // Smart Adjacent Pre-Fetching: pre-decode i - 1 and i + 1 images in memory
  useEffect(() => {
    if (!isOpen || !items || items.length === 0) return;

    const adjacentIndices = [activeIdx - 1, activeIdx + 1].filter(
      (i) => i >= 0 && i < items.length
    );

    adjacentIndices.forEach((idx) => {
      const targetItem = items[idx];
      if (!targetItem) return;
      const targetUrl = getMediaUrl(targetItem.url || targetItem.path || targetItem.id);
      if (!targetUrl || isVideoExtension(targetUrl)) return;

      const img = new Image();
      img.decoding = 'async';
      img.src = targetUrl;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });
  }, [isOpen, activeIdx, items]);

  // Dynamic Pan Limits & Screen Coverage Math
  const calculatePanLimits = useCallback((currentScale: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let baseW = imgRef.current?.offsetWidth || baseDimensionsRef.current.w;
    let baseH = imgRef.current?.offsetHeight || baseDimensionsRef.current.h;

    if (baseW <= 0 || baseH <= 0) {
      if (imgDimensions?.width && imgDimensions?.height) {
        const fit = Math.min((vw * 0.9) / imgDimensions.width, (vh * 0.85) / imgDimensions.height);
        baseW = imgDimensions.width * fit;
        baseH = imgDimensions.height * fit;
      } else {
        baseW = vw * 0.8;
        baseH = vh * 0.8;
      }
    }

    const scaledW = baseW * currentScale;
    const scaledH = baseH * currentScale;

    // Generous, unrestricted pan limits so the user can smoothly move the image anywhere
    const maxPanX = Math.max(
      (scaledW - vw) / 2 + vw * 0.65,
      scaledW * 0.6,
      vw * 0.8
    );
    const maxPanY = Math.max(
      (scaledH - vh) / 2 + vh * 0.65,
      scaledH * 0.6,
      vh * 0.8
    );

    return { maxPanX, maxPanY, baseW, baseH };
  }, [imgDimensions]);

  // Controlled Zoom Level Setter (used by Zoom Column, Wheel & Double-Tap)
  const setZoomLevel = useCallback((newScale: number, smooth = true) => {
    const clampedScale = Math.max(1, Math.min(4.5, newScale));
    scaleRef.current = clampedScale;
    setScale(clampedScale);

    if (clampedScale <= 1.02) {
      positionRef.current = { x: 0, y: 0 };
      setPos({ x: 0, y: 0 });
      if (imgRef.current) {
        imgRef.current.style.transition = smooth ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        imgRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      }
    } else {
      const { maxPanX, maxPanY } = calculatePanLimits(clampedScale);
      const nextX = Math.max(-maxPanX, Math.min(maxPanX, positionRef.current.x));
      const nextY = Math.max(-maxPanY, Math.min(maxPanY, positionRef.current.y));
      positionRef.current = { x: nextX, y: nextY };
      setPos({ x: nextX, y: nextY });
      if (imgRef.current) {
        imgRef.current.style.transition = smooth ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        imgRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0px) scale(${clampedScale})`;
      }
    }
  }, [calculatePanLimits]);

  // Handle window resizing while zoomed to prevent edge gaps
  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current && scaleRef.current <= 1.05 && imgRef.current.offsetWidth > 0) {
        baseDimensionsRef.current = {
          w: imgRef.current.offsetWidth,
          h: imgRef.current.offsetHeight,
        };
      } else if (scaleRef.current > 1.05) {
        const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
        const nextX = Math.max(-maxPanX, Math.min(maxPanX, positionRef.current.x));
        const nextY = Math.max(-maxPanY, Math.min(maxPanY, positionRef.current.y));
        positionRef.current = { x: nextX, y: nextY };
        setPos({ x: nextX, y: nextY });
        if (imgRef.current) {
          imgRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0px) scale(${scaleRef.current})`;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePanLimits]);

  // Keep unzoomed dimensions updated
  useEffect(() => {
    if (scale <= 1.05 && imgRef.current && imgRef.current.offsetWidth > 0) {
      baseDimensionsRef.current = {
        w: imgRef.current.offsetWidth,
        h: imgRef.current.offsetHeight,
      };
    }
  }, [scale, activeIdx]);

  const isTouchOnImage = useCallback((clientX: number, clientY: number) => {
    if (!imgRef.current) return false;
    const rect = imgRef.current.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  // Universal Double-Tap / Double-Click Zoom Engine
  const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastDoubleTapTimeRef.current = Date.now();
    lastGestureTimeRef.current = Date.now();
    hapticMedium();
    setAnimationClass('');

    const img = imgRef.current;

    if (scaleRef.current > 1.05) {
      // Zoom out to 1x
      scaleRef.current = 1;
      positionRef.current = { x: 0, y: 0 };
      setScale(1);
      setPos({ x: 0, y: 0 });
      setIsTransitioning(true);
      if (img) {
        img.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        img.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
        img.style.cursor = 'pointer';
      }
      setTimeout(() => {
        if (imgRef.current) imgRef.current.style.transition = 'none';
        setIsTransitioning(false);
      }, 280);
    } else {
      // Zoom in to 2.5x centered on tap/click coordinates
      const targetScale = 2.5;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = vw / 2;
      const cy = vh / 2;

      let nextX = (cx - clientX) * (targetScale - 1);
      let nextY = (cy - clientY) * (targetScale - 1);

      const { maxPanX, maxPanY } = calculatePanLimits(targetScale);
      nextX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
      nextY = Math.max(-maxPanY, Math.min(maxPanY, nextY));

      scaleRef.current = targetScale;
      positionRef.current = { x: nextX, y: nextY };
      setScale(targetScale);
      setPos({ x: nextX, y: nextY });
      setIsTransitioning(true);
      if (img) {
        img.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        img.style.transform = `translate3d(${nextX}px, ${nextY}px, 0px) scale(${targetScale})`;
        img.style.cursor = 'grab';
      }
      setTimeout(() => {
        if (imgRef.current) imgRef.current.style.transition = 'none';
        setIsTransitioning(false);
      }, 280);
    }
  }, [calculatePanLimits]);

  // Hardware-Accelerated Multi-Touch & Gesture Engine
  useEffect(() => {
    const container = imageContainerRef.current;
    const img = imgRef.current;
    if (!container || !img || type !== 'image') return;

    let currentScale = scaleRef.current;
    let posX = positionRef.current.x;
    let posY = positionRef.current.y;

    const applyTransform = (smooth = false) => {
      if (!img) return;
      img.style.transition = smooth ? 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
      img.style.transform = `translate3d(${posX}px, ${posY}px, 0px) scale(${currentScale})`;
      scaleRef.current = currentScale;
      positionRef.current = { x: posX, y: posY };
    };

    const commitTransform = (smooth = false) => {
      applyTransform(smooth);
      setScale(currentScale);
      setPos({ x: posX, y: posY });
    };

    let lastTapTime = 0;
    let lastTapPos = { x: 0, y: 0 };
    let startTouchX = 0;
    let startTouchY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let isPinching = false;
    let isPanning = false;
    let initialPinchDist = 0;
    let initialPinchScale = 1;
    let initialPinchMidX = 0;
    let initialPinchMidY = 0;
    let initialPinchPosX = 0;
    let initialPinchPosY = 0;

    const onTouchStart = (e: TouchEvent) => {
      currentScale = scaleRef.current;
      posX = positionRef.current.x;
      posY = positionRef.current.y;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeDiff = now - lastTapTime;
        const dist = Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y);

        // Double-tap detection (< 380ms and < 50px)
        if (timeDiff > 40 && timeDiff < 380 && dist < 50) {
          e.preventDefault();
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          lastDoubleTapTimeRef.current = Date.now();
          lastGestureTimeRef.current = Date.now();
          lastTapTime = 0;
          handleDoubleTap(touch.clientX, touch.clientY);
          currentScale = scaleRef.current;
          posX = positionRef.current.x;
          posY = positionRef.current.y;
          return;
        }

        lastTapTime = now;
        lastTapPos = { x: touch.clientX, y: touch.clientY };
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;

        // Free pan & drag engages after > 8px intentional movement (allowing pure single taps to pass through)
        setAnimationClass('');
        isPanning = false;
        startPanX = positionRef.current.x;
        startPanY = positionRef.current.y;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        setAnimationClass('');
        isPinching = true;
        isPanning = false;
        lastGestureTimeRef.current = Date.now();

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        initialPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        initialPinchMidX = (t0.clientX + t1.clientX) / 2;
        initialPinchMidY = (t0.clientY + t1.clientY) / 2;
        initialPinchScale = scaleRef.current;
        initialPinchPosX = positionRef.current.x;
        initialPinchPosY = positionRef.current.y;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialPinchDist > 0) {
        e.preventDefault();
        lastGestureTimeRef.current = Date.now();

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const currentMidX = (t0.clientX + t1.clientX) / 2;
        const currentMidY = (t0.clientY + t1.clientY) / 2;

        const scaleRatio = currentDist / initialPinchDist;
        currentScale = Math.min(Math.max(initialPinchScale * scaleRatio, 0.8), 5.0);

        const deltaX = currentMidX - initialPinchMidX;
        const deltaY = currentMidY - initialPinchMidY;
        posX = initialPinchPosX + deltaX;
        posY = initialPinchPosY + deltaY;

        applyTransform(false);
      } else if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        const dx = touch.clientX - startTouchX;
        const dy = touch.clientY - startTouchY;
        const dist = Math.hypot(dx, dy);

        if (!isPanning && dist > 8) {
          isPanning = true;
        }

        if (isPanning) {
          e.preventDefault();
          lastGestureTimeRef.current = Date.now();
          const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
          let nextX = startPanX + dx;
          let nextY = startPanY + dy;

          // Elastic boundary resistance
          if (nextX > maxPanX) nextX = maxPanX + (nextX - maxPanX) * 0.25;
          if (nextX < -maxPanX) nextX = -maxPanX + (nextX + maxPanX) * 0.25;
          if (nextY > maxPanY) nextY = maxPanY + (nextY - maxPanY) * 0.25;
          if (nextY < -maxPanY) nextY = -maxPanY + (nextY + maxPanY) * 0.25;

          posX = nextX;
          posY = nextY;
          applyTransform(false);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const remainingTouches = e.touches.length;

      if (isPinching && remainingTouches < 2) {
        isPinching = false;
        initialPinchDist = 0;
        lastGestureTimeRef.current = Date.now();

        if (currentScale < 1.05) {
          currentScale = 1;
          posX = 0;
          posY = 0;
          commitTransform(true);
        } else {
          if (currentScale > 4.5) currentScale = 4.5;
          const { maxPanX, maxPanY } = calculatePanLimits(currentScale);
          posX = Math.max(-maxPanX, Math.min(maxPanX, posX));
          posY = Math.max(-maxPanY, Math.min(maxPanY, posY));
          commitTransform(true);
        }
        return;
      }

      if (remainingTouches === 0) {
        if (isPanning) {
          isPanning = false;
          const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
          posX = Math.max(-maxPanX, Math.min(maxPanX, posX));
          posY = Math.max(-maxPanY, Math.min(maxPanY, posY));
          commitTransform(true);
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastDoubleTapTimeRef.current = Date.now();
      lastGestureTimeRef.current = Date.now();
      handleDoubleTap(e.clientX, e.clientY);
      currentScale = scaleRef.current;
      posX = positionRef.current.x;
      posY = positionRef.current.y;
    };

    let isMouseDown = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setAnimationClass('');
      isMouseDown = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startPanX = positionRef.current.x;
      startPanY = positionRef.current.y;
      if (img) img.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
      let nextX = startPanX + dx;
      let nextY = startPanY + dy;
      nextX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
      nextY = Math.max(-maxPanY, Math.min(maxPanY, nextY));
      posX = nextX;
      posY = nextY;
      applyTransform(false);
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (isMouseDown) {
        isMouseDown = false;
        if (img) img.style.cursor = 'grab';
        commitTransform(false);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();
      setAnimationClass('');

      const delta = -e.deltaY * 0.002;
      const nextScale = Math.min(Math.max(currentScale + delta, 1.0), 4.5);

      if (Math.abs(nextScale - currentScale) > 0.003) {
        currentScale = nextScale;
        if (currentScale <= 1.02) {
          posX = 0;
          posY = 0;
        } else {
          const { maxPanX, maxPanY } = calculatePanLimits(currentScale);
          posX = Math.max(-maxPanX, Math.min(maxPanX, posX));
          posY = Math.max(-maxPanY, Math.min(maxPanY, posY));
        }
        commitTransform(false);
      }
    };

    const onWindowResize = () => {
      if (imgRef.current && imgRef.current.offsetWidth > 0) {
        baseDimensionsRef.current = {
          w: imgRef.current.offsetWidth,
          h: imgRef.current.offsetHeight,
        };
        const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
        posX = Math.max(-maxPanX, Math.min(maxPanX, positionRef.current.x));
        posY = Math.max(-maxPanY, Math.min(maxPanY, positionRef.current.y));
        commitTransform(false);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    container.addEventListener('dblclick', onDoubleClick);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);

      container.removeEventListener('dblclick', onDoubleClick);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onWindowResize);
      container.removeEventListener('wheel', onWheel);
    };
  }, [activeUrl, activeIdx, type, calculatePanLimits, handleDoubleTap, goToNext, goToPrev, hasItemList, items?.length]);

  const handleDownload = useCallback(async () => {
    if (!activeUrl || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const filename = activeTitle
        ? `${activeTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${type === 'video' ? 'mp4' : 'jpg'}`
        : `media_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;

      if (type === 'video') {
        await downloadBrandedVideo(activeUrl, filename);
      } else {
        await applyWatermarkAndDownload(activeUrl, filename);
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch {
      await downloadMedia(activeUrl, activeTitle || 'download');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } finally {
      setIsDownloading(false);
    }
  }, [activeUrl, activeTitle, type, isDownloading]);


  if (!isOpen || !activeUrl || typeof document === 'undefined') return null;

  const secureUrl = activeUrl.replace(/^http:\/\//i, 'https://');
  const cleanTitle = sanitizeMediaTitle(activeTitle, type === 'video' ? 'Video' : 'Photograph');

  return createPortal(
    <div
      ref={mediaBoxRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex items-center justify-center overflow-hidden touch-none select-none overscroll-none animate-backdrop-fade"
      style={{
        touchAction: 'none',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(2, 4, 8, 0.75)',
      }}
      onClick={(e) => {
        if (Date.now() - lastDoubleTapTimeRef.current < 400) return;
        if (Date.now() - lastGestureTimeRef.current < 400) return;
        if (scaleRef.current > 1.05) {
          resetZoom();
          return;
        }
        if (type === 'image' && !isTouchOnImage(e.clientX, e.clientY)) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          onClose();
        } else if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Brand Watermark Logo on Bottom-Right: click opens navigation dock on any screen */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          hapticMedium();
          window.dispatchEvent(new CustomEvent('streamvault_open_dock'));
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center select-none cursor-pointer transition-all duration-300 ease-out opacity-80 hover:opacity-100 hover:scale-105 pointer-events-auto"
        title="Open Navigation Dock"
      >
        <div className="flex items-center">
          <HeaderBrandLogo trackingClass="tracking-[0.2em]" />
        </div>
      </div>

      {/* Universal Bottom-Left Image Viewer Control Tray (Globally for Any Screen) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-2 p-2 rounded-none bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border-0 shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-2rem)] overflow-x-auto space-scrollbar ${
          showControls ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Previous Photo Button */}
        {hasItemList && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            disabled={activeIdx <= 0}
            className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Previous Photo (←)"
            aria-label="Previous photo"
          >
            <LaserPrevIcon size={22} />
          </button>
        )}

        {/* Photo Counter */}
        {hasItemList && (
          <span
            className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
            style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
          >
            {activeIdx + 1} <span className="text-white/40">/</span> {items.length}
          </span>
        )}

        {/* Next Photo Button */}
        {hasItemList && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            disabled={activeIdx >= items.length - 1}
            className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none"
            title="Next Photo (→)"
            aria-label="Next photo"
          >
            <LaserNextIcon size={22} />
          </button>
        )}

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoomLevel(scaleRef.current + 0.35);
          }}
          disabled={scale >= 4.5}
          className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none text-slate-300 hover:text-white"
          title="Zoom In (+)"
          aria-label="Zoom in"
        >
          <LaserZoomInIcon size={20} />
        </button>

        {/* Zoom Percentage / 100% Reset Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          className={`reticle-btn px-2 h-9 rounded-none text-xs font-mono font-bold cursor-pointer border-0 ${
            scale > 1.05 ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
          }`}
          title="Reset Zoom (Fit to Screen)"
          aria-label="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoomLevel(scaleRef.current - 0.35);
          }}
          disabled={scale <= 1.02}
          className="reticle-btn w-9 h-9 cursor-pointer border-0 disabled:opacity-25 disabled:pointer-events-none text-slate-300 hover:text-white"
          title="Zoom Out (−)"
          aria-label="Zoom out"
        >
          <LaserZoomOutIcon size={20} />
        </button>

        {/* Download Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          disabled={isDownloading}
          className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white disabled:opacity-40 border-0"
          title="Download Original Photo"
          aria-label="Download photo"
        >
          {downloadSuccess ? (
            <Check className="w-5 h-5 text-emerald-400" />
          ) : isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
          ) : (
            <LaserDownloadIcon size={22} />
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="reticle-btn reticle-btn-close w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
          title="Close (Esc)"
          aria-label="Close image viewer"
        >
          <LaserCloseIcon size={22} />
        </button>
      </div>

      {/* Picasa Full-Screen Viewport Stage (100% Uncluttered Screen Canvas) */}
      <div
        ref={imageContainerRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            if (Date.now() - lastDoubleTapTimeRef.current < 400) return;
            if (Date.now() - lastGestureTimeRef.current < 400) return;
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = null;
            }
            if (scaleRef.current > 1.05) {
              resetZoom();
              return;
            }
            onClose();
          }
        }}
        className="relative z-30 w-full h-full flex items-center justify-center pointer-events-auto overflow-hidden select-none"
      >
        <img
          key={currentItem?.id || activeUrl || activeIdx}
          ref={imgRef}
          src={getMediaUrl(secureUrl)}
          alt={cleanTitle}
          onClick={(e) => {
            e.stopPropagation();
            const now = Date.now();
            if (now - lastDoubleTapTimeRef.current < 400) return;
            if (now - lastGestureTimeRef.current < 350) return;

            // If another click occurs within 300ms, it is a double click/tap: abort single-tap tray toggle
            if (now - lastClickTimeRef.current < 300) {
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              lastClickTimeRef.current = now;
              return;
            }
            lastClickTimeRef.current = now;

            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = null;
            }

            singleTapTimerRef.current = setTimeout(() => {
              setShowControls((prev) => !prev);
              singleTapTimerRef.current = null;
            }, 250);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = null;
            }
            lastDoubleTapTimeRef.current = Date.now();
            lastGestureTimeRef.current = Date.now();
            setAnimationClass('');
            handleDoubleTap(e.clientX, e.clientY);
          }}
          onDragStart={(e) => e.preventDefault()}
          onError={(e) => {
            if (currentItem?.thumbnail && e.currentTarget.src !== currentItem.thumbnail) {
              e.currentTarget.src = currentItem.thumbnail;
            }
          }}
          onLoad={(e) => {
            setImgDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
            if (e.currentTarget.offsetWidth > 0) {
              baseDimensionsRef.current = {
                w: e.currentTarget.offsetWidth,
                h: e.currentTarget.offsetHeight,
              };
            }
          }}
          onAnimationEnd={() => {
            setAnimationClass('');
          }}
          style={{
            transformOrigin: 'center center',
            willChange: 'transform',
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0px) scale(${scale})`,
            transition: isTransitioning ? 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            overscrollBehavior: 'none',
            maxHeight: '92vh',
            maxWidth: '94vw',
            cursor: 'grab',
          }}
          className={`pointer-events-auto select-none touch-none object-contain will-change-transform rounded-none drop-shadow-[0_20px_45px_rgba(0,0,0,0.9)] active:cursor-grabbing ${animationClass}`}
          draggable={false}
        />
      </div>
    </div>,
    document.body
  );
};

export default MediaModal;
