import React, { useEffect, useState } from 'react';

interface CyberSplashProps {
  onComplete?: () => void;
}

export const CyberSplash: React.FC<CyberSplashProps> = ({ onComplete }) => {
  const [dismissed, setDismissed] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // 2.5s cinematic playback
    const dismissTimer = setTimeout(() => {
      setDismissed(true);
    }, 2500);

    // Unmount after smooth fade out (0.65s transition)
    const removeTimer = setTimeout(() => {
      setRemoved(true);
      if (onComplete) onComplete();
    }, 3150);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(removeTimer);
    };
  }, [onComplete]);

  if (removed) return null;

  return (
    <div id="cyber-splash-root" className={`cyber-splash-root ${dismissed ? 'dismissed' : ''}`}>
      <div className="hud-grid-overlay" />

      {/* Viewfinder Reticle Corners */}
      <div className="hud-bracket hud-top-left" />
      <div className="hud-bracket hud-top-right" />
      <div className="hud-bracket hud-bottom-left" />
      <div className="hud-bracket hud-bottom-right" />

      <div className="lens-stage">
        <div className="telemetry-readout telemetry-top">
          SYS.BOOT // PROTOCOL: OPTIC-02 // 2.5s
        </div>

        {/* Dynamic Iris Aperture Assembly */}
        <div className="aperture-core">
          <div className="aperture-ring-outer" />
          <div className="aperture-ring-ticks" />

          <div className="aperture-blade-iris">
            <div className="iris-blade blade-1" />
            <div className="iris-blade blade-2" />
            <div className="iris-blade blade-3" />
            <div className="iris-blade blade-4" />
            <div className="iris-blade blade-5" />
            <div className="iris-blade blade-6" />
          </div>

          <div className="lens-flare-beam" />

          <div className="aperture-center-logo">
            <svg viewBox="0 0 100 100" className="aperture-play-svg">
              <polygon points="36,25 78,50 36,75" fill="#38bdf8" />
            </svg>
          </div>
        </div>

        {/* Identity & Progress */}
        <div className="hud-identity">
          <h1 className="hud-title">SARWARCYOU</h1>
          <div className="hud-status">
            <span className="status-dot" />
            <span className="status-text">QUANTUM VAULT INITIALIZED</span>
          </div>
          <div className="hud-progress-slot">
            <div className="hud-progress-fill" />
          </div>
        </div>

        <div className="telemetry-readout telemetry-bottom">
          CALIBRATING OPTICAL STREAM // 4K NATIVE
        </div>
      </div>
    </div>
  );
};
