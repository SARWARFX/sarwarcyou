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
  Star,
  Sparkles,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { CyberMediaSidebar } from './CyberMediaSidebar';
import { lockToLandscape, unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';
import { isItemFavorite, toggleFavorite } from '../utils/favoritesManager';
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

  // Vault Favorites State
  const [isFav, setIsFav] = useState(false);
  useEffect(() => {
    setIsFav(isItemFavorite(currentItem));
  }, [currentItem, activeIdx]);

  const handleToggleFav = () => {
    if (!currentItem) return;
    const nowFav = toggleFavorite(currentItem);
    setIsFav(nowFav);
  };

  // Ken Burns Slideshow / Story Mode State
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);

  const toggleSlideshow = () => {
    hapticLight();
    setIsSlideshowActive((prev) => !prev);
  };

  useEffect(() => {
    if (!isSlideshowActive || !hasItemList || items.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => {
        const next = prev >= items.length - 1 ? 0 : prev + 1;
        onIndexChange?.(next);
        return next;
      });
    }, 4500);

    return () => clearInterval(interval);
  }, [isSlideshowActive, hasItemList, items.length, onIndexChange]);

  // Reset whenever displayed photo changes
  useEffect(() => {
    resetZoom();
  }, [activeIdx, activeUrl, resetZoom]);

  const handleNext = useCallback(() => {
    if (!hasItemList || activeIdx >= items.length - 1) return;
    hapticLight();
    const next = activeIdx + 1;
    setActiveIdx(next);
    resetZoom();
    isDraggingRef.current = false;
    hasDraggedRef.current = false;
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange, resetZoom]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    hapticLight();
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
    unlockOrientation();
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
      if (type === 'video') {
        lockToLandscape();
      }
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
  }, [isFullscreen, type, exitFullscreen, wakeFullscreenClose]);

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      if (isFullscreen) {
        exitFullscreen();
        return true;
      }
      if (scale > 1.05) {
        resetZoom();
        return true;
      }
      if (showSidebar) {
        setShowSidebar(false);
        return true;
      }
      unlockOrientation();
      onClose();
      return true;
    }, [isFullscreen, scale, showSidebar, exitFullscreen, resetZoom, onClose]),
    isOpen
  );

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



  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const handlePrevRef = useRef(handlePrev);
  handlePrevRef.current = handlePrev;
  const hasNextRef = useRef(Boolean(hasItemList && activeIdx < items.length - 1));
  hasNextRef.current = Boolean(hasItemList && activeIdx < items.length - 1);
  const hasPrevRef = useRef(Boolean(hasItemList && activeIdx > 0));
  hasPrevRef.current = Boolean(hasItemList && activeIdx > 0);

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
    let lastTouchX = 0;
    let lastTouchY = 0;
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
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;

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
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
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

        // Horizontal swipe navigation at 1x
        if (currentScale <= 1.05 && touchMoved) {
          const dx = lastTouchX - startTouchX;
          const dy = lastTouchY - startTouchY;
          const isHorizontalSwipe = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy);

          if (isHorizontalSwipe) {
            lastGestureTimeRef.current = Date.now();
            if (dx < -50 && hasNextRef.current) {
              img.style.transition = 'transform 0.16s ease-out, opacity 0.16s ease-out';
              img.style.transform = `translate3d(-80px, 0px, 0px) scale(1)`;
              img.style.opacity = '0.5';
              setTimeout(() => {
                handleNextRef.current();
                posX = 0;
                posY = 0;
                currentScale = 1;
                if (img) {
                  img.style.transition = 'none';
                  img.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
                  img.style.opacity = '1';
                }
              }, 120);
              return;
            } else if (dx > 50 && hasPrevRef.current) {
              img.style.transition = 'transform 0.16s ease-out, opacity 0.16s ease-out';
              img.style.transform = `translate3d(80px, 0px, 0px) scale(1)`;
              img.style.opacity = '0.5';
              setTimeout(() => {
                handlePrevRef.current();
                posX = 0;
                posY = 0;
                currentScale = 1;
                if (img) {
                  img.style.transition = 'none';
                  img.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
                  img.style.opacity = '1';
                }
              }, 120);
              return;
            }
          }

          if (posX !== 0 || posY !== 0) {
            posX = 0;
            posY = 0;
            currentScale = 1;
            applyTransform(true);
          }
        }

        // Single tap to toggle HUD controls
        if (!touchMoved && Date.now() - lastTapTime < 250) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
          }
          singleTapTimerRef.current = setTimeout(() => {
            setShowControls((prev) => !prev);
            singleTapTimerRef.current = null;
          }, 280);
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
  }, [activeUrl, activeIdx, isFullscreen, type]);

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
        onClick={(e) => {
          if (Date.now() - lastGestureTimeRef.current < 400) return;
          if (!isTouchOnImage(e.clientX, e.clientY)) {
            exitFullscreen();
          }
        }}
        onMouseMove={wakeFullscreenClose}
      >
        {/* Edge-to-Edge Pure Photo */}
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
            className="pointer-events-auto select-none touch-none object-contain max-w-full max-h-full will-change-transform animate-fade-in"
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
          className={`pointer-events-auto fixed top-4 right-4 sm:top-6 sm:right-6 z-[160] w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            showControls && showFullscreenClose
              ? 'opacity-100 scale-100'
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
        if (Date.now() - lastGestureTimeRef.current < 400) return;
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
        {/* Full-screen controls overlay wrapper: pointer-events-none lets pointer hits pass straight through */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {/* Top Bar Header */}
          <header
            className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-black/60 via-transparent to-transparent transition-opacity duration-300 pointer-events-none ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Top Left Corner: Info Only */}
            <div className="flex items-center gap-3 text-white/90 min-w-0 pr-4 pointer-events-none">
              <span
                className="text-sm font-semibold tracking-wide truncate max-w-xs md:max-w-md pointer-events-none"
                style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
              >
                {currentItem?.title || currentItem?.name || cleanTitle}
              </span>
              {hasItemList && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 font-serif flex-shrink-0 border border-white/10 pointer-events-none">
                  {activeIdx + 1} / {items.length}
                </span>
              )}
            </div>

            {/* Top Right Corner: Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 pointer-events-none">
              {/* Clean Original Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className={`pointer-events-auto p-2 rounded-full transition-all cursor-pointer border ${
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
                className={`pointer-events-auto p-2 rounded-full transition-all cursor-pointer border ${
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

              {/* Ken Burns Slideshow / Story Mode Toggle */}
              {type === 'image' && hasItemList && (
                <button
                  type="button"
                  onClick={toggleSlideshow}
                  className={`pointer-events-auto p-2 rounded-full border transition-all cursor-pointer ${
                    isSlideshowActive
                      ? 'text-cyan-400 bg-cyan-500/20 border-cyan-400/50 shadow-[0_0_12px_rgba(56,189,248,0.4)] animate-pulse'
                      : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
                  }`}
                  title={isSlideshowActive ? 'Pause Slideshow' : 'Play Slideshow (Story Mode)'}
                  aria-label="Toggle slideshow"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              {/* Vault Favorite Toggle */}
              <button
                type="button"
                onClick={handleToggleFav}
                className={`pointer-events-auto p-2 rounded-full border transition-all cursor-pointer ${
                  isFav
                    ? 'text-amber-400 bg-amber-500/20 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                    : 'text-white/80 hover:text-white hover:bg-white/10 border-white/10 hover:border-white/30'
                }`}
                title={isFav ? 'Remove from Vault Favorites' : 'Save to Vault Favorites'}
                aria-label="Toggle Vault Favorite"
              >
                <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${isFav ? 'fill-amber-400' : ''}`} />
              </button>

              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="pointer-events-auto p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full border border-white/10 hover:border-white/30 transition-all cursor-pointer"
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
                className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-md flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 ml-1"
                title="Close (Esc)"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </header>

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
                className={`pointer-events-auto absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:pointer-events-none active:scale-95 ${
                  showControls && !isZoomed ? 'opacity-100' : 'opacity-0 !pointer-events-none'
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
                className={`pointer-events-auto absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/[0.06] hover:bg-white/10 backdrop-blur-md border border-white/[0.12] hover:border-white/40 text-white/90 hover:text-white hover:shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-20 disabled:pointer-events-none active:scale-95 ${
                  showControls && !isZoomed ? 'opacity-100' : 'opacity-0 !pointer-events-none'
                }`}
                title="Next (Right Arrow)"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}
        </div>

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
          onClick={(e) => {
            if (Date.now() - lastGestureTimeRef.current < 400) return;
            if (type === 'image' && !isTouchOnImage(e.clientX, e.clientY)) {
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              onClose();
            }
          }}
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
                className={`pointer-events-auto select-none touch-none object-contain max-w-full max-h-full will-change-transform rounded-xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)] ${
                  isSlideshowActive ? 'transition-transform duration-[4500ms] ease-out scale-105' : 'animate-fade-in'
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
