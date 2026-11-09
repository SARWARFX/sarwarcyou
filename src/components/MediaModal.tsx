import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Download,
  Loader2,
  Maximize,
  Minimize,
  Check,
  ChevronLeft,
  ChevronRight,
  Share2,
  X,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { CyberMediaSidebar } from './CyberMediaSidebar';
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
  onIndexChange,
  allFolders = [],
  onSelectFolder,
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(propCurrentIndex);
  const [scale, setScale] = useState<number>(1);
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isZoomed = scale > 1.05;

  // Single Tap to Toggle Controls (with 250ms double-tap protection)
  const [showControls, setShowControls] = useState<boolean>(true);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showSidebar, setShowSidebar] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isLightboxFullscreen;

  // Media Stream & EXIF Telemetry HUD
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  // Auto-hiding close button for truly full screen photo mode
  const [showFullscreenClose, setShowFullscreenClose] = useState(true);
  const fullscreenCloseTimerRef = useRef<number | null>(null);

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseDimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Desktop Mouse Drag & Pan State
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    posX: number;
    posY: number;
    time: number;
    isPan: boolean;
    isSwipe: boolean;
  }>({ x: 0, y: 0, posX: 0, posY: 0, time: 0, isPan: false, isSwipe: false });
  const hasDraggedRef = useRef<boolean>(false);

  // Gesture Tracking State (kept in refs for 60fps performance without React re-render lag)
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const initialDistanceRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1);
  const startTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const gestureModeRef = useRef<'NONE' | 'SWIPE' | 'PAN' | 'PINCH'>('NONE');

  // Helper to apply hardware-accelerated transform directly
  const updateTransform = useCallback(() => {
    if (imgRef.current) {
      const { scale: currentScale, x, y } = transformRef.current;
      imgRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${currentScale})`;
      imgRef.current.style.transition =
        gestureModeRef.current === 'NONE'
          ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          : 'none';
    }
  }, []);

  // Reset transform on image change
  const resetZoom = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    gestureModeRef.current = 'NONE';
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    if (imgRef.current) {
      imgRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      imgRef.current.style.transition = 'transform 0.25s ease';
    }
  }, []);

  const applyTransform = useCallback((newScale: number, newX: number, newY: number, animated = false, syncState = true) => {
    transformRef.current = { scale: newScale, x: newX, y: newY };
    scaleRef.current = newScale;
    positionRef.current = { x: newX, y: newY };
    if (syncState) {
      setScale(newScale);
    }
    if (imgRef.current) {
      imgRef.current.style.transition = animated ? 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
      imgRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0) scale(${newScale})`;
    }
  }, []);

  const wakeFullscreenClose = useCallback(() => {
    setShowFullscreenClose(true);
    if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    fullscreenCloseTimerRef.current = window.setTimeout(() => {
      setShowFullscreenClose(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    };
  }, []);

  const [prevPropKey, setPrevPropKey] = useState({ propCurrentIndex, isOpen });
  if (prevPropKey.propCurrentIndex !== propCurrentIndex || prevPropKey.isOpen !== isOpen) {
    setPrevPropKey({ propCurrentIndex, isOpen });
    setActiveIdx(propCurrentIndex);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    setShowControls(true);
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
  }

  // Determine active media item
  const hasItemList = items && items.length > 0;
  const currentItem = hasItemList ? items[activeIdx] : null;
  const activeUrl = currentItem?.url || url;
  const activeTitle = currentItem?.title || title || (type === 'video' ? 'Video Stream' : 'Photograph');

  const handleNext = useCallback(() => {
    if (!hasItemList || activeIdx >= items.length - 1) return;
    const next = activeIdx + 1;
    setActiveIdx(next);
    applyTransform(1, 0, 0, false, true);
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange, applyTransform]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    applyTransform(1, 0, 0, false, true);
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(prev);
  }, [hasItemList, activeIdx, onIndexChange, applyTransform]);

  // Sync native fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsNativeFullscreen(isFull);
      if (!isFull) {
        setIsLightboxFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    };
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    setIsLightboxFullscreen(false);
    setIsNativeFullscreen(false);
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      setIsLightboxFullscreen(true);
      wakeFullscreenClose();
      const el = mediaBoxRef.current || document.documentElement;
      if (el) {
        const req = el.requestFullscreen || (el as any).webkitRequestFullscreen;
        if (req) {
          req.call(el)
            .then(() => setIsNativeFullscreen(true))
            .catch(() => setIsLightboxFullscreen(true));
          return;
        }
      }
      setIsLightboxFullscreen(true);
    }
  }, [isFullscreen, exitFullscreen, wakeFullscreenClose]);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Keyboard navigation & gestures
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSidebar) {
          setShowSidebar(false);
          return;
        }
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isFullscreen, toggleFullscreen, exitFullscreen, showSidebar, handleNext, handlePrev]);

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

  // -------------------------------------------------------------
  // Dynamic Pan Limits & Screen Coverage Math
  // -------------------------------------------------------------
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

    // Generous, free pan limits so every detail, corner, and edge can be moved freely across the screen
    const maxPanX = Math.max(
      Math.max(0, (scaledW - vw) / 2) + vw * 0.45,
      scaledW * 0.5,
      vw * 0.5
    );
    const maxPanY = Math.max(
      Math.max(0, (scaledH - vh) / 2) + vh * 0.45,
      scaledH * 0.5,
      vh * 0.5
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
        updateTransform();
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

  // -------------------------------------------------------------
  // Dedicated Native Non-Passive Touch Engine & Gesture Handlers
  // -------------------------------------------------------------
  useEffect(() => {
    resetZoom();
  }, [activeIdx, activeUrl, resetZoom]);

  const handleDoubleTap = useCallback((tapX?: number, tapY?: number) => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (transformRef.current.scale > 1.05) {
      resetZoom();
    } else {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetScale = 2.5;

      const clientX = typeof tapX === 'number' ? tapX : vw / 2;
      const clientY = typeof tapY === 'number' ? tapY : vh / 2;

      const tapOffsetX = clientX - vw / 2;
      const tapOffsetY = clientY - vh / 2;
      const { maxPanX, maxPanY } = calculatePanLimits(targetScale);

      const initialX = Math.max(-maxPanX, Math.min(maxPanX, -tapOffsetX * (targetScale - 1)));
      const initialY = Math.max(-maxPanY, Math.min(maxPanY, -tapOffsetY * (targetScale - 1)));

      applyTransform(targetScale, initialX, initialY, true, true);
    }
  }, [calculatePanLimits, applyTransform, resetZoom]);

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

  // ATTACH NATIVE NON-PASSIVE LISTENERS VIA USEEFFECT (Defeats mobile Chrome passive overrides)
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || type !== 'image') return;

    const getDistance = (t1: Touch, t2: Touch) => {
      return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    };

    const handleTouchStart = (e: TouchEvent) => {
      wakeFullscreenClose();

      if (e.touches.length === 2) {
        // Pinch Zoom Mode
        gestureModeRef.current = 'PINCH';
        initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        initialScaleRef.current = transformRef.current.scale;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        startTouchRef.current = { x: touch.clientX, y: touch.clientY };
        startPanRef.current = { x: transformRef.current.x, y: transformRef.current.y };

        // Double-tap detection
        const now = Date.now();
        if (now - lastTapTimeRef.current < 280) {
          e.preventDefault();
          if (transformRef.current.scale > 1.05) {
            // Reset to 1x
            resetZoom();
          } else {
            // Zoom to 2.5x centered on tapped coordinate
            const rect = container.getBoundingClientRect();
            const tapOffsetX = touch.clientX - (rect.left + rect.width / 2);
            const tapOffsetY = touch.clientY - (rect.top + rect.height / 2);
            const targetScale = 2.5;
            const maxPanX = Math.max(0, (rect.width * targetScale - rect.width) / 2);
            const maxPanY = Math.max(0, (rect.height * targetScale - rect.height) / 2);
            const targetX = Math.max(-maxPanX, Math.min(maxPanX, -tapOffsetX * (targetScale - 1)));
            const targetY = Math.max(-maxPanY, Math.min(maxPanY, -tapOffsetY * (targetScale - 1)));

            transformRef.current = { scale: targetScale, x: targetX, y: targetY };
            scaleRef.current = targetScale;
            positionRef.current = { x: targetX, y: targetY };
            setScale(targetScale);
            updateTransform();
          }
          gestureModeRef.current = 'NONE';
          lastTapTimeRef.current = 0;
          return;
        }
        lastTapTimeRef.current = now;

        if (transformRef.current.scale > 1.05) {
          gestureModeRef.current = 'PAN';
        } else {
          gestureModeRef.current = 'SWIPE';
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      wakeFullscreenClose();

      if (gestureModeRef.current === 'PINCH' && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        if (initialDistanceRef.current > 0) {
          const factor = currentDist / initialDistanceRef.current;
          const newScale = Math.min(Math.max(initialScaleRef.current * factor, 0.8), 4.5);
          transformRef.current.scale = newScale;
          scaleRef.current = newScale;
          updateTransform();
        }
      } else if (gestureModeRef.current === 'PAN' && e.touches.length === 1) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - startTouchRef.current.x;
        const deltaY = e.touches[0].clientY - startTouchRef.current.y;

        const rect = container.getBoundingClientRect();
        const currentScale = transformRef.current.scale;
        const maxPanX = Math.max(0, (rect.width * currentScale - rect.width) / 2) + rect.width * 0.15;
        const maxPanY = Math.max(0, (rect.height * currentScale - rect.height) / 2) + rect.height * 0.15;

        const targetX = startPanRef.current.x + deltaX;
        const targetY = startPanRef.current.y + deltaY;

        transformRef.current.x = Math.max(-maxPanX, Math.min(maxPanX, targetX));
        transformRef.current.y = Math.max(-maxPanY, Math.min(maxPanY, targetY));
        positionRef.current = { x: transformRef.current.x, y: transformRef.current.y };
        updateTransform();
      } else if (gestureModeRef.current === 'SWIPE' && e.touches.length === 1) {
        // Single finger at 1x scale: track swipe
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (gestureModeRef.current === 'PINCH') {
        if (e.touches.length === 0) {
          gestureModeRef.current = 'NONE';
          // Snap back if scaled below 1x
          if (transformRef.current.scale < 1) {
            resetZoom();
          } else if (transformRef.current.scale > 4) {
            transformRef.current.scale = 4;
            scaleRef.current = 4;
            setScale(4);
            updateTransform();
          } else {
            scaleRef.current = transformRef.current.scale;
            setScale(transformRef.current.scale);
          }
        }
      } else if (gestureModeRef.current === 'SWIPE') {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - startTouchRef.current.x;
        const deltaY = touch.clientY - startTouchRef.current.y;
        const threshold = 45; // 45px swipe trigger

        if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
          if (deltaX < 0) {
            handleNext(); // Swipe left -> next
          } else {
            handlePrev(); // Swipe right -> prev
          }
        } else if (Math.hypot(deltaX, deltaY) < 12) {
          // Stationary tap: check if tapped outside the image
          const wasOutside =
            !isTouchOnImage(touch.clientX, touch.clientY) &&
            !isTouchOnImage(startTouchRef.current.x, startTouchRef.current.y);

          if (wasOutside) {
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
              singleTapTimerRef.current = null;
            }
            onClose();
          } else {
            // Stationary single tap on the image: toggle HUD controls
            if (singleTapTimerRef.current) {
              clearTimeout(singleTapTimerRef.current);
            }
            singleTapTimerRef.current = setTimeout(() => {
              setShowControls((prev) => !prev);
              singleTapTimerRef.current = null;
            }, 280);
          }
        }
        gestureModeRef.current = 'NONE';
      } else if (gestureModeRef.current === 'PAN') {
        if (e.touches.length === 0) {
          gestureModeRef.current = 'NONE';
          scaleRef.current = transformRef.current.scale;
          positionRef.current = { x: transformRef.current.x, y: transformRef.current.y };
          setScale(transformRef.current.scale);

          // If stationary tap occurred outside the image even if in PAN mode:
          const touch = e.changedTouches[0];
          if (touch) {
            const deltaX = touch.clientX - startTouchRef.current.x;
            const deltaY = touch.clientY - startTouchRef.current.y;
            if (
              Math.hypot(deltaX, deltaY) < 12 &&
              !isTouchOnImage(touch.clientX, touch.clientY) &&
              !isTouchOnImage(startTouchRef.current.x, startTouchRef.current.y)
            ) {
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              onClose();
            }
          }
        }
      }
    };

    // ATTACH WITH { passive: false } TO DEFEAT BROWSER OVERRIDES
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [activeIdx, activeUrl, isFullscreen, type, handleNext, handlePrev, updateTransform, resetZoom, wakeFullscreenClose, isTouchOnImage, onClose]);

  // Desktop Mouse Drag & Pan Handlers (Pan when scale > 1.05, Swipe when scale <= 1.05)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary mouse button drag for images
    if (e.pointerType !== 'mouse' || e.button !== 0 || type !== 'image') {
      return;
    }
    // Prevent default browser image ghost drag or selection for mouse only
    if (e.pointerType === 'mouse' && e.cancelable && e.nativeEvent?.cancelable) {
      try {
        e.preventDefault();
      } catch {
        // ignore passive violations
      }
    }

    const isZoomedIn = scaleRef.current > 1.05;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: positionRef.current.x,
      posY: positionRef.current.y,
      time: performance.now(),
      isPan: isZoomedIn,
      isSwipe: !isZoomedIn,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // In case setPointerCapture is unsupported or element disconnected
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerType !== 'mouse') return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Movement threshold to distinguish drag from stationary click
    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }

    if (dragStartRef.current.isPan) {
      // Boundary clamp to keep the image covering the viewport without leaving empty gaps
      const { maxPanX, maxPanY } = calculatePanLimits(scaleRef.current);
      const nextX = Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.posX + dx));
      const nextY = Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.posY + dy));
      applyTransform(scaleRef.current, nextX, nextY, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;

      if (dragStartRef.current.isSwipe) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const dt = Math.max(1, performance.now() - dragStartRef.current.time);
        const velocityX = Math.abs(dx) / dt;

        const isSwipeLeft = (dx <= -40 || (dx <= -20 && velocityX >= 0.22)) && Math.abs(dx) > Math.abs(dy) * 0.55;
        const isSwipeRight = (dx >= 40 || (dx >= 20 && velocityX >= 0.22)) && Math.abs(dx) > Math.abs(dy) * 0.55;

        if (isSwipeLeft && hasItemList && activeIdx < items.length - 1) {
          handleNext();
        } else if (isSwipeRight && hasItemList && activeIdx > 0) {
          handlePrev();
        }
      }

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  // Stage Click and Double Click handlers
  const handleStageClick = (e: React.MouseEvent) => {
    // Suppress controls toggle if the user just completed dragging
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    // If clicked/tapped outside the image, close the image viewer
    if (type === 'image' && !isTouchOnImage(e.clientX, e.clientY)) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      onClose();
      return;
    }

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      setShowControls((prev) => !prev);
      singleTapTimerRef.current = null;
    }, 300);
  };

  const handleStageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    handleDoubleTap(e.clientX, e.clientY);
  };

  // Wheel zoom on desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (type !== 'image') return;
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.max(1, Math.min(6, scaleRef.current * zoomFactor));
    if (newScale <= 1.05) {
      applyTransform(1, 0, 0, true);
      setScale(1);
      isDraggingRef.current = false;
    } else {
      const { maxPanX, maxPanY } = calculatePanLimits(newScale);
      const nextX = Math.max(-maxPanX, Math.min(maxPanX, positionRef.current.x));
      const nextY = Math.max(-maxPanY, Math.min(maxPanY, positionRef.current.y));
      applyTransform(newScale, nextX, nextY, false);
      setScale(newScale);
    }
  };

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

  const handleSharePhoto = useCallback(async () => {
    if (!currentItem) return;
    const albumName = currentItem.category || currentItem.parentAlbum || '';
    const shareUrl = createShareableMediaUrl(currentItem, albumName);
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2200);
    }
  }, [currentItem]);

  if (!isOpen || !activeUrl) return null;

  const secureUrl = activeUrl.replace(/^http:\/\//i, 'https://');
  const cleanTitle = sanitizeMediaTitle(activeTitle, type === 'video' ? 'Video' : 'Photograph');

  // =========================================================================
  // 1. TRULY FULL SCREEN IMMERSIVE PHOTO CANVAS
  // =========================================================================
  if (isFullscreen && type === 'image') {
    return (
      <div
        ref={mediaBoxRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 w-full h-[100dvh] overflow-hidden z-[9999] select-none touch-none flex items-center justify-center animate-fade-in cursor-pointer"
        style={{
          background: 'rgba(2, 4, 8, 0.88)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          touchAction: 'none',
        }}
        onClick={handleStageClick}
        onDoubleClick={handleStageDoubleClick}
        onMouseMove={wakeFullscreenClose}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Edge-to-Edge Pure Photo */}
        <div
          ref={imageContainerRef}
          className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none select-none overscroll-none"
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            overscrollBehavior: 'none',
          }}
        >
          {/* Ambient Blurred Background for Rich Cinematic Depth Outside Image */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center"
          >
            <img
              src={getMediaUrl(secureUrl)}
              alt=""
              className="w-full h-full object-cover scale-125 filter blur-[40px] sm:blur-[60px] opacity-40 brightness-75 transition-opacity duration-300 pointer-events-none"
            />
            <div className="absolute inset-0 bg-[#020408]/50 backdrop-blur-md pointer-events-none" />
          </div>

          <img
            key={currentItem?.id || activeUrl || activeIdx}
            ref={imgRef}
            src={getMediaUrl(secureUrl)}
            alt={cleanTitle}
            onLoad={(e) => {
              setImgDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
              if (e.currentTarget.offsetWidth > 0) {
                baseDimensionsRef.current = {
                  w: e.currentTarget.offsetWidth,
                  h: e.currentTarget.offsetHeight,
                };
              }
            }}
            style={{
              transformOrigin: 'center center',
              willChange: 'transform',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              overscrollBehavior: 'none',
            }}
            className="relative z-10 max-w-full max-h-full object-contain select-none will-change-transform animate-fade-in"
            draggable={false}
          />
        </div>

        {/* Dedicated Auto-Hiding Close Button to return to normal Image Viewer */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            exitFullscreen();
          }}
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-[160] w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            showControls && showFullscreenClose
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-90 pointer-events-none'
          }`}
          title="Exit Fullscreen (Esc)"
        >
          <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    );
  }

  // =========================================================================
  // 2. NORMAL TWO-PANE SPLIT VIEW IMAGE VIEWER
  // =========================================================================
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 w-full max-w-full h-[100dvh] overflow-hidden z-[9999] flex flex-col md:flex-row select-none animate-fade-in touch-none overscroll-contain"
      style={{
        background: 'rgba(2, 4, 8, 0.88)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
      onClick={(e) => {
        if (showSidebar) {
          setShowSidebar(false);
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
      {/* 1. Left Pane: Primary Media Stage (~65-70% desktop width, 100% mobile) */}
      <div className="flex-1 relative flex flex-col justify-between overflow-hidden h-full min-h-[50vh] md:min-h-0 bg-transparent">
        {/* Top Bar Header */}
        <header
          className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Left Corner: Info Only */}
          <div className="flex items-center gap-3 text-white/90 min-w-0 pr-4">
            <span
              className="text-sm font-semibold tracking-wide truncate max-w-xs md:max-w-md"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              {currentItem?.title || currentItem?.name || cleanTitle}
            </span>
            {hasItemList && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-serif flex-shrink-0 border border-white/10">
                {activeIdx + 1} / {items.length}
              </span>
            )}
          </div>

          {/* Top Right Corner: Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Clean Original Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-2 rounded-full transition-all cursor-pointer border ${
                downloadSuccess
                  ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40'
                  : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
              } disabled:opacity-40`}
              title="Download Original Media"
              aria-label="Download image"
            >
              {downloadSuccess ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              ) : isDownloading ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-neutral-300" />
              ) : (
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Share / Copy Direct Link Button */}
            <button
              type="button"
              onClick={handleSharePhoto}
              className={`p-2 rounded-full transition-all cursor-pointer border ${
                shareSuccess
                  ? 'text-white bg-white/20 border-white/40 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
              }`}
              title={shareSuccess ? 'Link Copied to Clipboard!' : 'Share Image Link'}
              aria-label="Share image"
            >
              {shareSuccess ? (
                <Check className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-200" />
              ) : (
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/10 hover:border-white/30 transition-all cursor-pointer"
              title="Toggle Fullscreen (F)"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Floating Minimal Glass Close Button (✕) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-md flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 ml-1"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* EXIF & Media Telemetry HUD */}
        {showTelemetry && (
          <div
            className="absolute top-16 left-4 md:top-20 md:left-8 z-50 p-4 rounded-lg border border-neutral-700 font-serif text-xs text-neutral-300 select-text max-w-sm pointer-events-auto shadow-2xl animate-fade-in"
            style={{
              background: 'rgba(12, 13, 16, 0.9)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              textShadow: '0 1px 4px #000, 0 0 8px #000',
            }}
          >
            <div className="flex items-center justify-between border-b border-neutral-700 pb-2 mb-2.5">
              <span className="text-neutral-200 font-normal tracking-wider text-[11px] flex items-center gap-1.5 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                EXIF / Metadata
              </span>
              <button
                type="button"
                onClick={() => setShowTelemetry(false)}
                className="text-white/60 hover:text-white text-xs font-serif px-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between gap-4">
                <span className="text-white/50">NAME:</span>
                <span className="text-white font-medium truncate max-w-[200px]" title={cleanTitle}>
                  {cleanTitle}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">FORMAT:</span>
                <span className="text-white font-bold uppercase">
                  {secureUrl.split('.').pop()?.split('?')[0] || (type === 'video' ? 'MP4' : 'IMAGE')}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">DIMENSIONS:</span>
                <span className="text-white">
                  {imgDimensions ? `${imgDimensions.width} × ${imgDimensions.height} px` : 'Auto / Responsive'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">INDEX:</span>
                <span className="text-white">{activeIdx + 1} / {items.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/50">STORAGE REPO:</span>
                <span className="text-neutral-300 truncate max-w-[180px]">SARWARFX/stream-vault</span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10">
                <span className="text-white/50 text-[10px]">SOURCE PATH:</span>
                <span className="text-[10px] text-white/70 break-all bg-black/40 p-1.5 rounded border border-white/5 select-all">
                  {secureUrl}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Side Arrow Navigation within Left Pane: Floating minimal glass buttons */}
        {hasItemList && items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={activeIdx <= 0}
              className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:pointer-events-none active:scale-95 ${
                showControls && !isZoomed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={activeIdx >= items.length - 1}
              className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:pointer-events-none active:scale-95 ${
                showControls && !isZoomed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Main Media Stage */}
        <div
          ref={mediaBoxRef}
          className="flex-1 relative w-full h-full flex items-center justify-center p-2 sm:p-4 md:p-6 transition-all overflow-hidden touch-none select-none overscroll-none"
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            overscrollBehavior: 'none',
          }}
          onClick={handleStageClick}
          onDoubleClick={handleStageDoubleClick}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {type === 'video' ? (
            <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/10">
              <video
                src={getMediaUrl(secureUrl)}
                controls
                autoPlay
                preload="metadata"
                playsInline
                {...{ 'webkit-playsinline': 'true' }}
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div
              ref={imageContainerRef}
              className="relative w-full h-full flex items-center justify-center overflow-hidden touch-none select-none overscroll-none"
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                overscrollBehavior: 'none',
              }}
            >
              {/* Ambient Blurred Background for Rich Cinematic Depth Outside Image */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 flex items-center justify-center"
              >
                <img
                  src={getMediaUrl(secureUrl)}
                  alt=""
                  className="w-full h-full object-cover scale-125 filter blur-[40px] sm:blur-[60px] opacity-40 brightness-75 transition-opacity duration-300 pointer-events-none"
                />
                <div className="absolute inset-0 bg-[#020408]/50 backdrop-blur-md pointer-events-none" />
              </div>

              <img
                key={currentItem?.id || activeUrl || activeIdx}
                ref={imgRef}
                src={getMediaUrl(secureUrl)}
                alt={cleanTitle}
                onLoad={(e) => {
                  setImgDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                  if (e.currentTarget.offsetWidth > 0) {
                    baseDimensionsRef.current = {
                      w: e.currentTarget.offsetWidth,
                      h: e.currentTarget.offsetHeight,
                    };
                  }
                }}
                style={{
                  transformOrigin: 'center center',
                  willChange: 'transform',
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                  overscrollBehavior: 'none',
                }}
                className="relative z-10 w-auto h-auto object-contain select-none will-change-transform animate-fade-in max-w-full max-h-[82dvh] md:max-h-[85dvh] rounded-xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)]"
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Slide-out Queue & Suggestions Drawer (Responsive Bottom Sheet on Mobile, Right Drawer on Desktop) */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-[130] flex flex-col md:flex-row justify-end items-end md:items-stretch animate-fade-in pointer-events-auto overflow-hidden w-full max-w-full"
          style={{
            background: 'rgba(3, 5, 10, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowSidebar(false);
          }}
        >
          <div
            className="w-full md:w-auto h-[62vh] md:h-full max-h-[85vh] md:max-h-screen flex flex-col shadow-2xl pointer-events-auto overflow-hidden rounded-t-3xl md:rounded-t-none animate-slide-up md:animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            <CyberMediaSidebar
              items={items}
              activeItem={currentItem}
              activeIdx={activeIdx}
              onSelectItem={(_, idx) => {
                setActiveIdx(idx);
                setScale(1);
                onIndexChange?.(idx);
              }}
              mediaType="image"
              currentFolderName={currentItem?.category || 'Photo Archive'}
              allFolders={allFolders}
              onSelectFolder={onSelectFolder}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaModal;
