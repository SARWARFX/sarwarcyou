import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Loader2,
  Check,
  Share2,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticMedium } from '../utils/hapticsManager';
import { getLocalCachedPhotoUrl } from '../services/photoSyncManager';
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
  const scaleRef = useRef<number>(1);
  const positionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseDimensionsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Desktop Mouse Drag & Pan State
  const isDraggingRef = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false);
  const lastGestureTimeRef = useRef<number>(0);

  // Dedicated isolated Pinch & Double-Tap Engine refs (Zero swipe conflict)
  const transform = useRef({ scale: 1, x: 0, y: 0 });

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
      imgRef.current.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      imgRef.current.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
      setTimeout(() => {
        if (imgRef.current) imgRef.current.style.transition = 'none';
      }, 250);
    }
  }, []);

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

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      if (scale > 1.05) {
        resetZoom();
        return true;
      }
      unlockOrientation();
      onClose();
      return true;
    }, [scale, resetZoom, onClose]),
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

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

  // -------------------------------------------------------------
  // Dedicated Hardware-Accelerated Multi-Touch & Gesture Engine
  // (Bound to stage container to cover full viewport + letterbox)
  // -------------------------------------------------------------
  useEffect(() => {
    const container = imageContainerRef.current;
    const img = imgRef.current;
    if (!container || !img || type !== 'image') return;

    let currentScale = transform.current.scale || 1;
    let posX = transform.current.x || 0;
    let posY = transform.current.y || 0;

    if (scaleRef.current === 1) {
      currentScale = 1;
      posX = 0;
      posY = 0;
    }

    const applyTransform = (smooth = false) => {
      if (!img) return;
      img.style.transition = smooth ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
      img.style.transform = `translate3d(${posX}px, ${posY}px, 0px) scale(${currentScale})`;
      img.style.willChange = 'transform';
      img.style.transformOrigin = 'center center';
      transform.current = { scale: currentScale, x: posX, y: posY };
      scaleRef.current = currentScale;
      positionRef.current = { x: posX, y: posY };
    };

    const handleDoubleTap = (clientX: number, clientY: number) => {
      hapticMedium();
      lastGestureTimeRef.current = Date.now();
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }

      if (currentScale > 1.05) {
        currentScale = 1;
        posX = 0;
        posY = 0;
        applyTransform(true);
        setScale(1);
      } else {
        currentScale = 2.5;
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        posX = (cx - clientX) * 1.5;
        posY = (cy - clientY) * 1.5;
        applyTransform(true);
        setScale(2.5);
      }
    };

    // -------------------------------------------------------------
    // Touch Events: 2-Finger Pinch, Double-Tap, Pan, and 1x Swipe
    // -------------------------------------------------------------
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
    let touchMoved = false;

    const onTouchStart = (e: TouchEvent) => {
      touchMoved = false;

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();
        const timeDiff = now - lastTapTime;
        const dist = Math.hypot(touch.clientX - lastTapPos.x, touch.clientY - lastTapPos.y);

        // Double-tap detection (< 340ms and < 35px)
        if (timeDiff > 40 && timeDiff < 340 && dist < 35) {
          e.preventDefault();
          handleDoubleTap(touch.clientX, touch.clientY);
          lastTapTime = 0;
          return;
        }

        lastTapTime = now;
        lastTapPos = { x: touch.clientX, y: touch.clientY };
        startTouchX = touch.clientX;
        startTouchY = touch.clientY;

        if (currentScale > 1.05) {
          isPanning = true;
          startPanX = touch.clientX - posX;
          startPanY = touch.clientY - posY;
        }
      } else if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false;
        lastGestureTimeRef.current = Date.now();
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        initialPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        initialPinchMidX = (t0.clientX + t1.clientX) / 2;
        initialPinchMidY = (t0.clientY + t1.clientY) / 2;
        initialPinchScale = currentScale;
        initialPinchPosX = posX;
        initialPinchPosY = posY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching && initialPinchDist > 0) {
        e.preventDefault();
        touchMoved = true;
        lastGestureTimeRef.current = Date.now();

        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const currentMidX = (t0.clientX + t1.clientX) / 2;
        const currentMidY = (t0.clientY + t1.clientY) / 2;

        const scaleRatio = currentDist / initialPinchDist;
        currentScale = Math.min(Math.max(initialPinchScale * scaleRatio, 0.75), 4.5);

        const deltaX = currentMidX - initialPinchMidX;
        const deltaY = currentMidY - initialPinchMidY;
        posX = initialPinchPosX + deltaX;
        posY = initialPinchPosY + deltaY;

        applyTransform(false);
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - startTouchX;
        const dy = touch.clientY - startTouchY;

        if (Math.hypot(dx, dy) > 8) {
          touchMoved = true;
          lastGestureTimeRef.current = Date.now();
        }

        if (currentScale > 1.05 && isPanning) {
          e.preventDefault();
          posX = touch.clientX - startPanX;
          posY = touch.clientY - startPanY;
          applyTransform(false);
        } else if (currentScale <= 1.05) {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
            e.preventDefault();
            posX = dx * 0.4;
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

        if (currentScale < 1) {
          currentScale = 1;
          posX = 0;
          posY = 0;
          applyTransform(true);
          setScale(1);
        } else if (currentScale > 4) {
          currentScale = 4;
          applyTransform(true);
          setScale(4);
        } else {
          setScale(currentScale);
        }
        return;
      }

      if (remainingTouches === 0) {
        isPanning = false;

        // At 1x reset position if moved slightly
        if (currentScale <= 1.05 && touchMoved) {
          if (posX !== 0 || posY !== 0) {
            posX = 0;
            posY = 0;
            currentScale = 1;
            applyTransform(true);
          }
        }

        // Single tap
        if (!touchMoved && Date.now() - lastTapTime < 250) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
        }
      }
    };

    // -------------------------------------------------------------
    // Desktop Mouse & Trackpad Gestures (DoubleClick, Pan, Wheel Zoom)
    // -------------------------------------------------------------
    const onDoubleClick = (e: MouseEvent) => {
      e.preventDefault();
      handleDoubleTap(e.clientX, e.clientY);
    };

    let isMouseDown = false;
    let mouseStartX = 0;
    let mouseStartY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      mouseStartX = e.clientX - posX;
      mouseStartY = e.clientY - posY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || currentScale <= 1.05) return;
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();
      posX = e.clientX - mouseStartX;
      posY = e.clientY - mouseStartY;
      applyTransform(false);
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastGestureTimeRef.current = Date.now();

      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      if (e.ctrlKey) {
        // Trackpad 2-finger pinch zoom
        const zoomDelta = -e.deltaY * 0.012;
        const factor = Math.exp(zoomDelta);
        const targetScale = Math.min(Math.max(currentScale * factor, 1), 5);

        if (targetScale <= 1.02) {
          currentScale = 1;
          posX = 0;
          posY = 0;
        } else {
          const scaleChange = targetScale / currentScale;
          posX = e.clientX - (e.clientX - posX) * scaleChange;
          posY = e.clientY - (e.clientY - posY) * scaleChange;
          currentScale = targetScale;
        }
        applyTransform(false);
        setScale(currentScale);
      } else {
        // Mouse wheel scroll zoom
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const targetScale = Math.min(Math.max(currentScale * factor, 1), 5);
        if (targetScale <= 1.02) {
          currentScale = 1;
          posX = 0;
          posY = 0;
        } else {
          posX = (cx - e.clientX) * (targetScale - 1);
          posY = (cy - e.clientY) * (targetScale - 1);
          currentScale = targetScale;
        }
        applyTransform(true);
        setScale(currentScale);
      }
    };

    // Attach native event listeners to container (non-passive for touch & wheel so preventDefault works!)
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    container.addEventListener('dblclick', onDoubleClick);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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
      container.removeEventListener('wheel', onWheel);
    };
  }, [activeUrl, activeIdx, type]);

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

  return createPortal(
    <div
      ref={mediaBoxRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xl flex items-center justify-center overflow-hidden touch-none select-none overscroll-none animate-fade-in"
      style={{
        touchAction: 'none',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(2, 4, 8, 0.75)',
      }}
      onClick={(e) => {
        if (Date.now() - lastGestureTimeRef.current < 400) return;
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
      {/* Pure Image Stage */}
      <div
        ref={imageContainerRef}
        className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden touch-none"
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          overscrollBehavior: 'none',
        }}
      >
        <img
          ref={imgRef}
          src={getLocalCachedPhotoUrl(currentItem) || getMediaUrl(secureUrl)}
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
          className="pointer-events-auto select-none touch-none object-contain max-w-full max-h-full will-change-transform rounded-xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)] animate-fade-in"
          draggable={false}
        />
      </div>

      {/* Floating Download Button at Bottom Left */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        disabled={isDownloading}
        className="pointer-events-auto fixed bottom-6 left-6 z-50 p-3.5 rounded-full bg-white/[0.08] hover:bg-white/20 active:scale-95 backdrop-blur-xl border border-white/15 text-white/90 hover:text-white shadow-2xl transition-all cursor-pointer disabled:opacity-40"
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

      {/* Floating Share Button at Bottom Right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSharePhoto();
        }}
        className="pointer-events-auto fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-white/[0.08] hover:bg-white/20 active:scale-95 backdrop-blur-xl border border-white/15 text-white/90 hover:text-white shadow-2xl transition-all cursor-pointer"
        title={shareSuccess ? 'Link Copied!' : 'Share Photo'}
        aria-label="Share photo"
      >
        {shareSuccess ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <Share2 className="w-5 h-5" />
        )}
      </button>
    </div>,
    document.body
  );
};

export default MediaModal;
