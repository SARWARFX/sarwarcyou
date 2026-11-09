import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

  // Dedicated isolated Pinch & Double-Tap Engine refs (Zero swipe conflict)
  const transform = useRef({ scale: 1, x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialScale = useRef<number>(1);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const startPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);
  const singleTouchStartPos = useRef<{ x: number; y: number } | null>(null);

  const applyTransform = useCallback(() => {
    if (imgRef.current) {
      const { scale: currentScale, x, y } = transform.current;
      imgRef.current.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${currentScale})`;
    }
  }, []);

  const resetZoom = useCallback(() => {
    transform.current = { scale: 1, x: 0, y: 0 };
    scaleRef.current = 1;
    positionRef.current = { x: 0, y: 0 };
    setScale(1);
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.2s ease-out';
      imgRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      setTimeout(() => {
        if (imgRef.current) imgRef.current.style.transition = 'none';
      }, 200);
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

  // Reset whenever displayed photo changes
  useEffect(() => {
    resetZoom();
  }, [activeIdx, activeUrl, resetZoom]);

  const handleNext = useCallback(() => {
    if (!hasItemList || activeIdx >= items.length - 1) return;
    const next = activeIdx + 1;
    setActiveIdx(next);
    resetZoom();
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange, resetZoom]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    resetZoom();
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(prev);
  }, [hasItemList, activeIdx, onIndexChange, resetZoom]);

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
        applyTransform();
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

  // -------------------------------------------------------------
  // Dedicated Isolated Pinch-to-Zoom & Double-Tap Engine (No Swipe Conflict)
  // -------------------------------------------------------------
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

  const handleDoubleTap = useCallback(() => {
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    if (transform.current.scale > 1.05) {
      resetZoom();
    } else {
      transform.current = { scale: 2.5, x: 0, y: 0 };
      scaleRef.current = 2.5;
      setScale(2.5);
      if (imgRef.current) {
        imgRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        applyTransform();
        setTimeout(() => {
          if (imgRef.current) imgRef.current.style.transition = 'none';
        }, 250);
      }
    }
  }, [applyTransform, resetZoom]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || type !== 'image') return;

    const onTouchStart = (e: TouchEvent) => {
      wakeFullscreenClose();

      if (e.touches.length === 2) {
        // Two fingers: Pinch Zoom
        if (e.cancelable) e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchDist.current = dist;
        initialScale.current = transform.current.scale;
        startTouch.current = null;
        singleTouchStartPos.current = null;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        const touch = e.touches[0];
        singleTouchStartPos.current = { x: touch.clientX, y: touch.clientY };

        // Double-Tap Logic (< 280ms delta)
        if (now - lastTap.current < 280) {
          if (e.cancelable) e.preventDefault();
          if (transform.current.scale > 1.05) {
            resetZoom();
          } else {
            transform.current = { scale: 2.5, x: 0, y: 0 };
            scaleRef.current = 2.5;
            setScale(2.5);
            if (imgRef.current) {
              imgRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
              applyTransform();
              setTimeout(() => {
                if (imgRef.current) imgRef.current.style.transition = 'none';
              }, 250);
            }
          }
          lastTap.current = 0;
          return;
        }
        lastTap.current = now;

        // If already zoomed in, single-finger pans the photo
        if (transform.current.scale > 1.05) {
          startTouch.current = { x: touch.clientX, y: touch.clientY };
          startPan.current = { x: transform.current.x, y: transform.current.y };
        } else {
          startTouch.current = null;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      wakeFullscreenClose();

      // Multi-touch pinch zoom
      if (e.touches.length === 2 && initialPinchDist.current !== null) {
        if (e.cancelable) e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / initialPinchDist.current;
        const nextScale = Math.min(Math.max(initialScale.current * factor, 0.9), 4.5);
        transform.current.scale = nextScale;
        scaleRef.current = nextScale;
        applyTransform();
      }
      // Single-finger panning when zoomed in (Zero swipe navigation)
      else if (e.touches.length === 1 && startTouch.current && transform.current.scale > 1.05) {
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - startTouch.current.x;
        const dy = touch.clientY - startTouch.current.y;
        transform.current.x = startPan.current.x + dx;
        transform.current.y = startPan.current.y + dy;
        positionRef.current = { x: transform.current.x, y: transform.current.y };
        applyTransform();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDist.current = null;
      }
      if (e.touches.length === 0) {
        startTouch.current = null;

        // Snap back to 1x if pinched smaller than 1x
        if (transform.current.scale < 1) {
          resetZoom();
        } else if (transform.current.scale > 4) {
          transform.current.scale = 4;
          scaleRef.current = 4;
          setScale(4);
          applyTransform();
        } else {
          scaleRef.current = transform.current.scale;
          setScale(transform.current.scale);
        }

        // Tap handling: outside closes image, inside toggles controls
        const touch = e.changedTouches[0];
        if (touch && singleTouchStartPos.current) {
          const dx = touch.clientX - singleTouchStartPos.current.x;
          const dy = touch.clientY - singleTouchStartPos.current.y;

          if (Math.hypot(dx, dy) < 12) {
            const wasOutside =
              !isTouchOnImage(touch.clientX, touch.clientY) &&
              !isTouchOnImage(singleTouchStartPos.current.x, singleTouchStartPos.current.y);

            if (wasOutside) {
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              onClose();
            } else if (transform.current.scale <= 1.05) {
              // Stationary tap on the image: toggle HUD controls
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
              }
              singleTapTimerRef.current = setTimeout(() => {
                setShowControls((prev) => !prev);
                singleTapTimerRef.current = null;
              }, 280);
            }
          }
        }
        singleTouchStartPos.current = null;
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [activeIdx, activeUrl, isFullscreen, type, applyTransform, resetZoom, wakeFullscreenClose, isTouchOnImage, onClose]);

  // Desktop Mouse Drag & Pan Handlers (Pan only when scale > 1.05, no swipe)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || type !== 'image') return;
    if (transform.current.scale <= 1.05) return;

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: transform.current.x,
      posY: transform.current.y,
      time: performance.now(),
      isPan: true,
      isSwipe: false,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.pointerType !== 'mouse' || !dragStartRef.current.isPan) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }

    transform.current.x = dragStartRef.current.posX + dx;
    transform.current.y = dragStartRef.current.posY + dy;
    positionRef.current = { x: transform.current.x, y: transform.current.y };
    applyTransform();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    isDraggingRef.current = false;
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
    handleDoubleTap();
  };

  // Wheel zoom on desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (type !== 'image') return;
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.max(1, Math.min(6, transform.current.scale * zoomFactor));
    if (newScale <= 1.05) {
      resetZoom();
      isDraggingRef.current = false;
    } else {
      transform.current.scale = newScale;
      scaleRef.current = newScale;
      setScale(newScale);
      applyTransform();
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

  if (!isOpen || !activeUrl || typeof document === 'undefined') return null;

  const secureUrl = activeUrl.replace(/^http:\/\//i, 'https://');
  const cleanTitle = sanitizeMediaTitle(activeTitle, type === 'video' ? 'Video' : 'Photograph');

  // =========================================================================
  // 1. TRULY FULL SCREEN IMMERSIVE PHOTO CANVAS
  // =========================================================================
  if (isFullscreen && type === 'image') {
    return createPortal(
      <div
        ref={mediaBoxRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden touch-none select-none overscroll-none animate-fade-in cursor-pointer"
        style={{
          touchAction: 'none',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(2, 4, 8, 0.65)',
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
      </div>,
      document.body
    );
  }

  // =========================================================================
  // 2. NORMAL TWO-PANE SPLIT VIEW IMAGE VIEWER
  // =========================================================================
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden touch-none select-none overscroll-none animate-fade-in"
      style={{
        touchAction: 'none',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(2, 4, 8, 0.65)',
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
    </div>,
    document.body
  );
};

export default MediaModal;
