import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Download,
  Loader2,
  Maximize,
  Minimize,
  Check,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Share2,
  X,
  Info,
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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isZoomed = scale > 1.05;

  // Single Tap to Toggle Controls (with 250ms double-tap protection)
  const [showControls, setShowControls] = useState<boolean>(true);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

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
  const imgRef = useRef<HTMLImageElement>(null);
  const baseDimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    time: number;
  } | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);

  // Desktop Mouse Drag & Pan State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasDraggedRef = useRef<boolean>(false);

  // 2-Finger Pinch & Pan State Ref
  const pinchStateRef = useRef<{
    startDist: number;
    startScale: number;
    startPosition: { x: number; y: number };
    lastTouchX: number;
    lastTouchY: number;
    isPinching: boolean;
    isPanning: boolean;
  }>({
    startDist: 0,
    startScale: 1,
    startPosition: { x: 0, y: 0 },
    lastTouchX: 0,
    lastTouchY: 0,
    isPinching: false,
    isPanning: false,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

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
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setShowControls(true);
    setIsDragging(false);
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
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(prev);
  }, [hasItemList, activeIdx, onIndexChange]);

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
    setScale(1);
    setPosition({ x: 0, y: 0 });
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
    let baseW = baseDimensionsRef.current.w;
    let baseH = baseDimensionsRef.current.h;

    if (baseW <= 0 || baseH <= 0) {
      if (imgRef.current && imgRef.current.offsetWidth > 0 && imgRef.current.offsetHeight > 0) {
        baseW = imgRef.current.offsetWidth;
        baseH = imgRef.current.offsetHeight;
        baseDimensionsRef.current = { w: baseW, h: baseH };
      } else if (imgDimensions?.width && imgDimensions?.height) {
        const availW = isZoomed ? vw : vw - 64;
        const availH = isZoomed ? vh : vh * 0.85;
        const fit = Math.min(availW / imgDimensions.width, availH / imgDimensions.height);
        baseW = imgDimensions.width * fit;
        baseH = imgDimensions.height * fit;
      } else {
        baseW = vw;
        baseH = vh;
      }
    }

    const scaledW = baseW * currentScale;
    const scaledH = baseH * currentScale;

    // Pan limits guarantee image edges never pull inside the viewport borders
    const maxPanX = Math.max(0, (scaledW - vw) / 2);
    const maxPanY = Math.max(0, (scaledH - vh) / 2);

    return { maxPanX, maxPanY, baseW, baseH };
  }, [imgDimensions, isZoomed]);

  // Handle window resizing while zoomed to prevent edge gaps
  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current && scale <= 1.05 && imgRef.current.offsetWidth > 0) {
        baseDimensionsRef.current = {
          w: imgRef.current.offsetWidth,
          h: imgRef.current.offsetHeight,
        };
      } else if (scale > 1.05) {
        const { maxPanX, maxPanY } = calculatePanLimits(scale);
        setPosition((prev) => ({
          x: Math.max(-maxPanX, Math.min(maxPanX, prev.x)),
          y: Math.max(-maxPanY, Math.min(maxPanY, prev.y)),
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scale, calculatePanLimits]);

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
  // Mobile Touch Gestures & Desktop Zoom Handlers
  // -------------------------------------------------------------
  const handleDoubleTap = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    if (e) {
      if ('cancelable' in e && e.cancelable) {
        e.preventDefault();
      }
      if ('stopPropagation' in e) {
        e.stopPropagation();
      }
    }
    // Clear single-tap timer so controls don't flicker
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (scale > 1.05) {
      // ALWAYS RESET to natural default state when already zoomed
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      isDraggingRef.current = false;
      hasDraggedRef.current = false;
    } else {
      // Zoom in so image completely fills the browser window edge-to-edge
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { baseW, baseH } = calculatePanLimits(1);

      // Determine the minimum zoom scale required to cover the full viewport in both dimensions
      const scaleToFillW = vw / Math.max(1, baseW);
      const scaleToFillH = vh / Math.max(1, baseH);
      const minCoverScale = Math.max(scaleToFillW, scaleToFillH);

      // Guarantee at least 2.5x zoom and full-screen edge-to-edge coverage
      const targetScale = Math.max(2.5, minCoverScale * 1.05);

      // Compute tap coordinates to center zoom on the tapped point
      let clientX = vw / 2;
      let clientY = vh / 2;
      if (e && 'touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e && 'changedTouches' in e && (e as any).changedTouches.length > 0) {
        clientX = (e as any).changedTouches[0].clientX;
        clientY = (e as any).changedTouches[0].clientY;
      } else if (e && 'clientX' in e && typeof e.clientX === 'number') {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const tapOffsetX = clientX - vw / 2;
      const tapOffsetY = clientY - vh / 2;

      const scaledW = baseW * targetScale;
      const scaledH = baseH * targetScale;
      const maxPanX = Math.max(0, (scaledW - vw) / 2);
      const maxPanY = Math.max(0, (scaledH - vh) / 2);

      const initialX = Math.max(-maxPanX, Math.min(maxPanX, -tapOffsetX * (targetScale - 1) * 0.5));
      const initialY = Math.max(-maxPanY, Math.min(maxPanY, -tapOffsetY * (targetScale - 1) * 0.5));

      setScale(targetScale);
      setPosition({ x: initialX, y: initialY });
    }
  }, [scale, calculatePanLimits]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    wakeFullscreenClose();

    // Multi-touch: Two-finger pinch gesture setup
    if (e.touches.length === 2) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchStateRef.current = {
        startDist: dist,
        startScale: scale,
        startPosition: { ...position },
        lastTouchX: midX,
        lastTouchY: midY,
        isPinching: true,
        isPanning: false,
      };
      setTouchDeltaX(0);
      touchStateRef.current = null;
      return;
    }

    // Single finger touch
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = performance.now();
      const timeSinceLastTap = now - lastTapRef.current.time;
      const distFromLastTap = Math.hypot(
        t.clientX - lastTapRef.current.x,
        t.clientY - lastTapRef.current.y
      );

      // Double tap to zoom / reset (second tap within 300ms and 35px)
      if (timeSinceLastTap < 300 && distFromLastTap < 35) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        handleDoubleTap(e);
        touchStateRef.current = null;
        return;
      }

      // Drag / Pan while zoomed in (scale > 1.05)
      if (scale > 1.05) {
        pinchStateRef.current.isPanning = true;
        pinchStateRef.current.isPinching = false;
        pinchStateRef.current.lastTouchX = t.clientX;
        pinchStateRef.current.lastTouchY = t.clientY;
        touchStateRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          currentX: t.clientX,
          currentY: t.clientY,
          time: now,
        };
        return;
      }

      // Normal swipe gesture setup when at 1x
      touchStateRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        currentX: t.clientX,
        currentY: t.clientY,
        time: now,
      };
      setTouchDeltaX(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    wakeFullscreenClose();

    // Multi-touch: Two-finger continuous pinch zooming (clamped 1x to 4x)
    if (e.touches.length === 2 && pinchStateRef.current.isPinching) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchStateRef.current.startDist > 0) {
        const factor = dist / pinchStateRef.current.startDist;
        const newScale = Math.max(1, Math.min(4, pinchStateRef.current.startScale * factor));
        setScale(newScale);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dMidX = midX - pinchStateRef.current.lastTouchX;
        const dMidY = midY - pinchStateRef.current.lastTouchY;
        pinchStateRef.current.lastTouchX = midX;
        pinchStateRef.current.lastTouchY = midY;

        if (newScale <= 1.05) {
          setPosition({ x: 0, y: 0 });
        } else {
          const { maxPanX, maxPanY } = calculatePanLimits(newScale);
          setPosition((prev) => ({
            x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dMidX)),
            y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dMidY)),
          }));
        }
      }
      return;
    }

    // Drag / Pan with 1 finger when zoomed in (scale > 1.05)
    if (e.touches.length === 1 && scale > 1.05 && pinchStateRef.current.isPanning) {
      const t = e.touches[0];
      const dx = t.clientX - pinchStateRef.current.lastTouchX;
      const dy = t.clientY - pinchStateRef.current.lastTouchY;
      pinchStateRef.current.lastTouchX = t.clientX;
      pinchStateRef.current.lastTouchY = t.clientY;

      if (touchStateRef.current) {
        touchStateRef.current.currentX = t.clientX;
        touchStateRef.current.currentY = t.clientY;
      }

      // Boundary clamp to inspect every corner without losing image or leaving gaps
      const { maxPanX, maxPanY } = calculatePanLimits(scale);

      setPosition((prev) => ({
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dy)),
      }));
      return;
    }

    // Horizontal swipe preview feedback ONLY when scale <= 1.05
    if (!touchStateRef.current || scale > 1.05) return;
    const t = e.touches[0];
    touchStateRef.current.currentX = t.clientX;
    touchStateRef.current.currentY = t.clientY;

    const dx = t.clientX - touchStateRef.current.startX;
    const dy = t.clientY - touchStateRef.current.startY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setTouchDeltaX(Math.max(-80, Math.min(80, dx * 0.35)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();

    if (e.touches.length === 0) {
      pinchStateRef.current.isPinching = false;
      pinchStateRef.current.isPanning = false;

      // Snap back if pinched below 1.05x
      if (scale <= 1.05) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && pinchStateRef.current.isPinching) {
      pinchStateRef.current.isPinching = false;
      pinchStateRef.current.isPanning = scale > 1.05;
      const t = e.touches[0];
      pinchStateRef.current.lastTouchX = t.clientX;
      pinchStateRef.current.lastTouchY = t.clientY;
    }

    const state = touchStateRef.current;
    touchStateRef.current = null;
    setTouchDeltaX(0);

    if (!state) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    const dt = performance.now() - state.time;

    // Stationary single tap check (< 20px move & < 300ms)
    const isStationaryTap = Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300;
    if (isStationaryTap) {
      lastTapRef.current = {
        time: performance.now(),
        x: t.clientX,
        y: t.clientY,
      };

      // 250ms timeout to distinguish single tap from double tap
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
        singleTapTimerRef.current = null;
      }, 250);
      return;
    }

    // When scale > 1, horizontal swipe navigation is strictly disabled to allow free panning
    if (scale > 1.05) {
      return;
    }

    // Swipe down to dismiss
    if (dy > 120 && Math.abs(dx) < 60 && dt < 450) {
      onClose();
      return;
    }

    // Horizontal swipe navigation (distance > 50px)
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < -50) {
        handleNext();
      } else if (dx > 50) {
        handlePrev();
      }
    }
  };

  // Desktop Mouse Drag & Pan Handlers (when scale > 1.05)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only handle primary mouse button drag when zoomed in (scale > 1.05) and viewing an image
    if (e.pointerType !== 'mouse' || e.button !== 0 || scale <= 1.05 || type !== 'image') {
      return;
    }
    // Prevent default browser image ghost drag or selection
    e.preventDefault();

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    setIsDragging(true);

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
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
    if (Math.hypot(dx, dy) > 3) {
      hasDraggedRef.current = true;
    }

    // Boundary clamp to keep the image covering the viewport without leaving empty gaps
    const { maxPanX, maxPanY } = calculatePanLimits(scale);

    const nextX = Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.posX + dx));
    const nextY = Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.posY + dy));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
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
      setIsDragging(false);
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  // Desktop Click handlers (with double-click and drag suppression)
  const handleStageClick = () => {
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }

    // Suppress controls toggle if the user just completed dragging
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      setShowControls((prev) => !prev);
      singleTapTimerRef.current = null;
    }, 250);
  };

  const handleStageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    handleDoubleTap(e);
  };

  // Wheel zoom on desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (type !== 'image') return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.max(1, Math.min(6, scale * zoomFactor));
    setScale(newScale);
    if (newScale <= 1.05) {
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      isDraggingRef.current = false;
    } else {
      const { maxPanX, maxPanY } = calculatePanLimits(newScale);
      setPosition((prev) => ({
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y)),
      }));
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
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 w-full h-[100dvh] overflow-hidden z-[9999] select-none touch-none touch-action-none flex items-center justify-center animate-fade-in cursor-pointer"
        style={{
          background: 'rgba(3, 5, 10, 0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        onClick={handleStageClick}
        onDoubleClick={handleStageDoubleClick}
        onMouseMove={wakeFullscreenClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Edge-to-Edge Pure Photo */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img
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
              transform:
                touchDeltaX !== 0
                  ? `translateX(${touchDeltaX}px)`
                  : `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
              transition:
                pinchStateRef.current.isPinching ||
                pinchStateRef.current.isPanning ||
                isDragging ||
                touchDeltaX !== 0
                  ? 'none'
                  : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            className={`max-w-full max-h-full object-contain select-none will-change-transform ${
              isZoomed
                ? isDragging
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
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
      className="fixed inset-0 w-full max-w-full h-[100dvh] overflow-hidden z-[9999] flex flex-col md:flex-row select-none animate-fade-in touch-none touch-action-none overscroll-contain"
      style={{
        background: isZoomed ? '#000000' : 'rgba(3, 5, 10, 0.55)',
        backdropFilter: isZoomed ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: isZoomed ? 'none' : 'blur(12px)',
      }}
      onClick={(e) => {
        if (showSidebar) {
          setShowSidebar(false);
          return;
        }
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 1. Left Pane: Primary Media Stage (~65-70% desktop width, 100% mobile) */}
      <div className="flex-1 relative flex flex-col justify-between overflow-hidden h-full min-h-[50vh] md:min-h-0 bg-transparent">
        {/* Top Bar Header */}
        <header
          className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
            showControls && !isZoomed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
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
            {/* Queue / Playlist Drawer Button */}
            {hasItemList && (
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer border ${
                  showSidebar
                    ? 'text-white bg-white/20 border-white/40 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
                }`}
                title={showSidebar ? 'Hide Queue' : 'Show Queue'}
                aria-label="Toggle queue"
              >
                <ListVideo className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

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

            {/* EXIF & Telemetry HUD Toggle Button */}
            <button
              type="button"
              onClick={() => setShowTelemetry((prev) => !prev)}
              className={`p-2 rounded-full transition-all cursor-pointer border ${
                showTelemetry
                  ? 'text-white bg-white/20 border-white/40 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
              }`}
              title="EXIF & Image Telemetry"
              aria-label="Toggle telemetry HUD"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
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
          className={`flex-1 relative w-full h-full flex items-center justify-center ${
            isZoomed ? 'p-0' : 'p-3 sm:p-6 md:p-8'
          } transition-all overflow-hidden ${
            isZoomed
              ? isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : 'cursor-pointer'
          }`}
          onClick={handleStageClick}
          onDoubleClick={handleStageDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <img
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
                  transform:
                    touchDeltaX !== 0
                      ? `translateX(${touchDeltaX}px)`
                      : `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                  transition:
                    pinchStateRef.current.isPinching || pinchStateRef.current.isPanning || isDragging || touchDeltaX !== 0
                      ? 'none'
                      : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
                className={`w-auto h-auto object-contain select-none will-change-transform ${
                  isZoomed
                    ? `max-w-none max-h-none rounded-none drop-shadow-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`
                    : 'max-w-full max-h-[82dvh] md:max-h-[85dvh] rounded-xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)] cursor-zoom-in'
                }`}
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
                setPosition({ x: 0, y: 0 });
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
