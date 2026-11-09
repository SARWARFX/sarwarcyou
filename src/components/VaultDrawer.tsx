import React, { useEffect } from 'react';
import { hapticMedium } from '../utils/hapticsManager';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderId: 'clips' | 'shorts' | 'photography' | 'realtube') => void;
}

export const VaultDrawer: React.FC<VaultDrawerProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navigateToFolder = (folderId: 'clips' | 'shorts' | 'photography' | 'realtube') => {
    hapticMedium();
    onClose();
    onSelectFolder(folderId);
  };

  return (
    <>
      {/* Blurred Backdrop Overlay Mask */}
      <div
        className={`vault-overlay-mask ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sliding Side Panel */}
      <aside
        className={`vault-drawer-left ${isOpen ? 'open' : ''}`}
        aria-label="Concealed Core Archive Terminal"
      >
        <div className="vault-meta-tag">CORE ARCHIVE // TERMINAL</div>
        <ul className="folder-item-list">
          <li>
            <button
              type="button"
              onClick={() => navigateToFolder('clips')}
              className="folder-btn"
            >
              <span>CLIPS</span>
              <span className="folder-badge">STREAM</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => navigateToFolder('shorts')}
              className="folder-btn"
            >
              <span>SHORTS</span>
              <span className="folder-badge">REELS</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => navigateToFolder('photography')}
              className="folder-btn"
            >
              <span>PHOTOGRAPHY</span>
              <span className="folder-badge">VAULT</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => navigateToFolder('realtube')}
              className="folder-btn"
            >
              <span>REALTUBE</span>
              <span className="folder-badge">DRIVE</span>
            </button>
          </li>
        </ul>

        {/* Usage Telemetry Activity Bar Chart */}
        <div className="vault-telemetry-cluster">
          <div className="telemetry-bar-header">
            <span className="telemetry-stat">5.14</span>
            <span className="telemetry-history">141.10 98.00 64.00 147.00 38.00 115.00</span>
          </div>
          <div className="telemetry-bars">
            <div className="bar" style={{ height: '75%' }}></div>
            <div className="bar" style={{ height: '45%' }}></div>
            <div className="bar" style={{ height: '30%' }}></div>
            <div className="bar" style={{ height: '90%' }}></div>
            <div className="bar" style={{ height: '55%' }}></div>
            <div className="bar" style={{ height: '65%' }}></div>
            <div className="bar" style={{ height: '85%' }}></div>
          </div>
          <div className="telemetry-bar-footer">
            <span className="active-tag">TODAY</span>
            <span>YESTERDAY</span>
            <span>NOV 07</span>
            <span>NOV 06</span>
            <span>NOV 05</span>
            <span>NOV 04</span>
            <span>NOV 03</span>
          </div>
        </div>

        <div className="vault-footer-status">
          <span>ACCESS // GRANTED</span>
          <span>SYS READY</span>
        </div>
      </aside>
    </>
  );
};

export default VaultDrawer;
