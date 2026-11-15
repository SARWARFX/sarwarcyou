import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Loader2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';

import { unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticMedium } from '../utils/hapticsManager';
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
  const [animationClass, setAnimationClass] = useState<string>('animate-media-open');

  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastGestureTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const [showControls, setShowControls] = useState<boolean>(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Desktop vs Mobile layout detection (lg: = 1024px)
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const scheduleAutoHide = useCallback(() => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleUserActivity = useCallback(() => {
    setShowControls(true);
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  useEffect(() => {
    if (isOpen) {
      setShowControls(true);
      scheduleAutoHide();
    }
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, [isOpen, activeIdx, scheduleAutoHide]);

  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);

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
      setSlideDirection('next');
      setAnimationClass('animate-photo-slide-next');
      setActiveIdx(next);
      _onIndexChange?.(next);
      resetZoom();
    }
  }, [items, activeIdx, _onIndexChange, resetZoom]);

  const goToPrev = useCallback(() => {
    if (items && items.length > 0 && activeIdx > 0) {
      const prev = activeIdx - 1;
      setSlideDirection('prev');
      setAnimationClass('animate-photo-slide-prev');
      setActiveIdx(prev);
      _onIndexChange?.(prev);
      resetZoom();
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
    hapticMedium();
    lastGestureTimeRef.current = Date.now();
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
    let swipeDeltaX = 0;

    const onTouchStart = (e: TouchEvent) => {
      swipeDeltaX = 0;
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

        if (scaleRef.current > 1.05) {
          setAnimationClass('');
          isPanning = true;
          startPanX = positionRef.current.x;
          startPanY = positionRef.current.y;
        }
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
        swipeDeltaX = dx;

        if (scaleRef.current > 1.05 && isPanning) {
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
        } else if (scaleRef.current <= 1.05) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
            posX = dx * 0.38;
            posY = 0;
            applyTransform(false);
          }
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
        isPanning = false;

        if (scaleRef.current > 1.05) {
          const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
          posX = Math.max(-maxPanX, Math.min(maxPanX, posX));
          posY = Math.max(-maxPanY, Math.min(maxPanY, posY));
          commitTransform(true);
        } else {
          // Check 1x horizontal swipe navigation
          if (swipeDeltaX < -55 && hasItemList && activeIdx < (items?.length || 0) - 1) {
            goToNext();
          } else if (swipeDeltaX > 55 && hasItemList && activeIdx > 0) {
            goToPrev();
          } else {
            // Snap back to center
            posX = 0;
            posY = 0;
            commitTransform(true);
          }
        }
      }
    };

    const onDoubleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
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
      if (img) img.style.cursor = scaleRef.current > 1.05 ? 'grabbing' : 'grab';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (scaleRef.current > 1.05) {
        const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
        let nextX = startPanX + dx;
        let nextY = startPanY + dy;
        nextX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
        nextY = Math.max(-maxPanY, Math.min(maxPanY, nextY));
        posX = nextX;
        posY = nextY;
        applyTransform(false);
      } else {
        // Drag swipe preview when not zoomed
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          posX = dx * 0.35;
          posY = 0;
          applyTransform(false);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (isMouseDown) {
        isMouseDown = false;
        if (img) img.style.cursor = scaleRef.current > 1.05 ? 'grab' : 'pointer';
        if (scaleRef.current > 1.05) {
          commitTransform(false);
        } else {
          const dx = e.clientX - dragStartX;
          if (dx < -45 && hasItemList && activeIdx < (items?.length || 0) - 1) {
            goToNext();
          } else if (dx > 45 && hasItemList && activeIdx > 0) {
            goToPrev();
          } else {
            posX = 0;
            posY = 0;
            commitTransform(true);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();
      setAnimationClass('');

      // Horizontal trackpad swipe navigation
      if (!e.ctrlKey && scaleRef.current <= 1.05 && Math.abs(e.deltaX) > 25 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (e.deltaX > 25 && hasItemList && activeIdx < (items?.length || 0) - 1) {
          goToNext();
          return;
        } else if (e.deltaX < -25 && hasItemList && activeIdx > 0) {
          goToPrev();
          return;
        }
      }

      let targetScale = scaleRef.current;
      if (e.ctrlKey) {
        // Trackpad pinch zoom
        const factor = Math.exp(-e.deltaY * 0.012);
        targetScale = Math.min(Math.max(scaleRef.current * factor, 1), 5);
      } else {
        // Mouse wheel scroll zoom
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        targetScale = Math.min(Math.max(scaleRef.current * factor, 1), 5);
      }

      if (targetScale <= 1.02) {
        currentScale = 1;
        posX = 0;
        posY = 0;
        commitTransform(true);
      } else {
        const scaleChange = targetScale / scaleRef.current;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = vw / 2;
        const cy = vh / 2;
        let nextX = e.clientX - cx - (e.clientX - cx - positionRef.current.x) * scaleChange;
        let nextY = e.clientY - cy - (e.clientY - cy - positionRef.current.y) * scaleChange;
        const { maxPanX, maxPanY } = calculatePanLimits(targetScale);
        nextX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
        nextY = Math.max(-maxPanY, Math.min(maxPanY, nextY));
        currentScale = targetScale;
        posX = nextX;
        posY = nextY;
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

  const prevPhotoItem = hasItemList && activeIdx > 0 ? items[activeIdx - 1] : null;
  const nextPhotoItem = hasItemList && activeIdx < items.length - 1 ? items[activeIdx + 1] : null;

  return createPortal(
    <div
      ref={mediaBoxRef}
      role="dialog"
      aria-modal="true"
      onMouseMove={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex items-center justify-center overflow-hidden touch-none select-none overscroll-none animate-backdrop-fade"
      style={{
        touchAction: 'none',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(2, 4, 8, 0.75)',
      }}
      onClick={(e) => {
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
      {/* Floating Close Button at Top Right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={`pointer-events-auto fixed top-6 right-6 z-50 p-3.5 rounded-full bg-black/60 hover:bg-neutral-800 active:scale-95 backdrop-blur-xl border border-white/15 text-white/90 hover:text-[#ccff00] shadow-2xl transition-all duration-300 cursor-pointer ${
          showControls ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-90'
        }`}
        title="Close (Esc)"
        aria-label="Close image viewer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Unified Side-by-Side 3-Card Stage: PREV | ACTIVE (on top) | NEXT */}
      <div className="relative z-10 w-full h-full flex items-center justify-center gap-3 sm:gap-5 xl:gap-8 overflow-hidden pointer-events-none px-4 sm:px-6">
        {/* 1. Left Previous Media Card (Side-by-side, smaller, z-10 underneath) */}
        {prevPhotoItem ? (
          <div
            key={`photo-prev-${activeIdx}-${slideDirection}`}
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
            className={`hidden lg:flex shrink-0 items-center justify-center group cursor-pointer transition-all duration-300 z-10 pointer-events-auto ${
              scale <= 1.05 ? 'opacity-90 hover:opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            } ${
              slideDirection === 'next'
                ? 'animate-flank-elevate-up'
                : slideDirection === 'prev'
                ? 'animate-flank-dip-down'
                : ''
            }`}
            style={{ width: 'clamp(180px, 14vw, 240px)' }}
            title={`Previous: ${prevPhotoItem.title || prevPhotoItem.name}`}
          >
            <div className="relative w-full aspect-[3/4] max-h-[70vh] rounded-2xl overflow-hidden bg-black/75 border border-white/15 group-hover:border-[#ccff00]/60 group-hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] transition-all duration-300">
              <img
                src={prevPhotoItem.thumbnail || getMediaUrl(prevPhotoItem.url || prevPhotoItem.path || prevPhotoItem.id)}
                alt={prevPhotoItem.title || 'Previous photo'}
                className="w-full h-full object-cover brightness-[0.45] group-hover:brightness-[0.75] transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent flex items-center justify-center">
                <div className={`w-11 h-11 rounded-full bg-black/70 border border-white/20 group-hover:border-[#ccff00] group-hover:bg-[#ccff00] group-hover:text-black flex items-center justify-center text-white/80 transition-all duration-200 shadow-2xl backdrop-blur-sm ${
                  showControls ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
                }`}>
                  <ChevronLeft className="w-6 h-6 -ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none px-2">
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-300 group-hover:text-[#ccff00] font-bold">
                  PREV
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="hidden lg:block shrink-0 pointer-events-none invisible"
            style={{ width: 'clamp(180px, 14vw, 240px)' }}
          />
        )}

        {/* 2. Middle Active Main Image Card (z-30 on top of any overlap) */}
        <div
          ref={imageContainerRef}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (Date.now() - lastGestureTimeRef.current < 400) return;
              if (scaleRef.current > 1.05) {
                resetZoom();
                return;
              }
              onClose();
            }
          }}
          className="relative z-30 flex items-center justify-center shrink-0 min-w-0 max-w-full max-h-full pointer-events-auto overflow-visible"
        >
          <img
            key={currentItem?.id || activeUrl || activeIdx}
            ref={imgRef}
            src={getMediaUrl(secureUrl)}
            alt={cleanTitle}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - lastGestureTimeRef.current < 350) return;
              if (scaleRef.current > 1.05) return;
              setShowControls((prev) => !prev);
              if (!showControls) {
                scheduleAutoHide();
              } else if (hideControlsTimerRef.current) {
                clearTimeout(hideControlsTimerRef.current);
              }
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAnimationClass('');
              handleDoubleTap(e.clientX, e.clientY);
            }}
            onDragStart={(e) => e.preventDefault()}
            onError={(e) => {
              // Hotlink / 403 protection: fall back to high-reliability thumbnail or unproxied source
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
              maxHeight: isDesktop ? '82vh' : '100vh',
              maxWidth: isDesktop ? 'min(58vw, calc(100vw - 480px))' : '100vw',
              cursor: scale > 1.05 ? 'grab' : 'pointer',
            }}
            className={`pointer-events-auto select-none touch-none object-contain will-change-transform rounded-xl drop-shadow-[0_20px_45px_rgba(0,0,0,0.9)] ${animationClass}`}
            draggable={false}
          />
        </div>

        {/* 3. Right Next Media Card (Side-by-side, smaller, z-10 underneath) */}
        {nextPhotoItem ? (
          <div
            key={`photo-next-${activeIdx}-${slideDirection}`}
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className={`hidden lg:flex shrink-0 items-center justify-center group cursor-pointer transition-all duration-300 z-10 pointer-events-auto ${
              scale <= 1.05 ? 'opacity-90 hover:opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
            } ${
              slideDirection === 'next'
                ? 'animate-flank-dip-down'
                : slideDirection === 'prev'
                ? 'animate-flank-elevate-up'
                : ''
            }`}
            style={{ width: 'clamp(180px, 14vw, 240px)' }}
            title={`Next: ${nextPhotoItem.title || nextPhotoItem.name}`}
          >
            <div className="relative w-full aspect-[3/4] max-h-[70vh] rounded-2xl overflow-hidden bg-black/75 border border-white/15 group-hover:border-[#ccff00]/60 group-hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] transition-all duration-300">
              <img
                src={nextPhotoItem.thumbnail || getMediaUrl(nextPhotoItem.url || nextPhotoItem.path || nextPhotoItem.id)}
                alt={nextPhotoItem.title || 'Next photo'}
                className="w-full h-full object-cover brightness-[0.45] group-hover:brightness-[0.75] transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-transparent to-transparent flex items-center justify-center">
                <div className={`w-11 h-11 rounded-full bg-black/70 border border-white/20 group-hover:border-[#ccff00] group-hover:bg-[#ccff00] group-hover:text-black flex items-center justify-center text-white/80 transition-all duration-200 shadow-2xl backdrop-blur-sm ${
                  showControls ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
                }`}>
                  <ChevronRight className="w-6 h-6 -mr-0.5" />
                </div>
              </div>
              <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none px-2">
                <span className="text-xs font-mono uppercase tracking-widest text-neutral-300 group-hover:text-[#ccff00] font-bold">
                  NEXT
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="hidden lg:block shrink-0 pointer-events-none invisible"
            style={{ width: 'clamp(180px, 14vw, 240px)' }}
          />
        )}
      </div>

      {/* Floating Download Button at Bottom Left */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        disabled={isDownloading}
        className={`pointer-events-auto fixed bottom-6 left-6 z-50 p-3.5 rounded-full bg-black/60 hover:bg-neutral-800 active:scale-95 backdrop-blur-xl border border-white/15 text-white/90 hover:text-white shadow-2xl transition-all duration-300 cursor-pointer disabled:opacity-40 ${
          showControls ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-90'
        }`}
        title="Download Original Photo"
        aria-label="Download photo"
      >
        {downloadSuccess ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : isDownloading ? (
          <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
        ) : (
          <Download className="w-5 h-5" />
        )}
      </button>

    </div>,
    document.body
  );
};

export default MediaModal;
