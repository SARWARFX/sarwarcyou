import React, { useEffect, useState } from 'react';
import { hapticMedium } from '../utils/hapticsManager';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube',
    subfolderId?: string
  ) => void;
}

interface SubFolder {
  id: string;
  name: string;
  tag: string;
}

interface VaultFolder {
  id: 'clips' | 'shorts' | 'photography' | 'realtube';
  name: string;
  tag: string;
  subfolders: SubFolder[];
}

const folders: VaultFolder[] = [
  {
    id: 'clips',
    name: 'CLIPS',
    tag: 'STREAM',
    subfolders: [
      { id: 'featured-clips', name: 'FEATURED CLIPS', tag: 'STREAM' },
      { id: 'trailers-teasers', name: 'TRAILERS & TEASERS', tag: '4K' },
      { id: 'studio-edits', name: 'STUDIO EDITS', tag: 'RAW' },
    ],
  },
  {
    id: 'shorts',
    name: 'SHORTS',
    tag: 'REELS',
    subfolders: [
      { id: 'shorts-2027', name: 'SHORTS 2027', tag: 'SERIES' },
      { id: 'shorts-classic', name: 'SHORTS CLASSIC', tag: 'VAULT' },
    ],
  },
  {
    id: 'photography',
    name: 'PHOTOGRAPHY',
    tag: 'VAULT',
    subfolders: [
      { id: 'editorial-portraits', name: 'EDITORIAL PORTRAITS', tag: 'HD' },
      { id: 'studio-sessions', name: 'STUDIO SESSIONS', tag: 'ARCHIVE' },
      { id: 'event-galleries', name: 'EVENT GALLERIES', tag: 'RAW' },
    ],
  },
  {
    id: 'realtube',
    name: 'REALTUBE',
    tag: 'DRIVE',
    subfolders: [
      { id: 'long-form-media', name: 'LONG-FORM MEDIA', tag: 'DRIVE A' },
      { id: 'production-storage', name: 'PRODUCTION STORAGE', tag: 'DRIVE B' },
      { id: 'simulated-volumes', name: 'SIMULATED VOLUMES', tag: 'SYSTEM' },
    ],
  },
];

export const VaultDrawer: React.FC<VaultDrawerProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
}) => {
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

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

  const navigateToSubfolder = (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube',
    subfolderId: string
  ) => {
    hapticMedium();
    onClose();
    onSelectFolder(folderId, subfolderId);
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

        {/* Inline Accordion Dropdown Navigation */}
        <div className="folder-accordion-menu space-scrollbar">
          {folders.map((folder) => {
            const isExpanded = expandedFolder === folder.id;
            return (
              <div
                key={folder.id}
                className={`accordion-group ${isExpanded ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="folder-btn"
                  onClick={() => {
                    hapticMedium();
                    setExpandedFolder(isExpanded ? null : folder.id);
                  }}
                >
                  <span className="folder-label">
                    <span className={`folder-caret ${isExpanded ? 'open' : ''}`}>▸</span>
                    {folder.name}
                  </span>
                  <span className="folder-badge">{folder.tag}</span>
                </button>

                {isExpanded && (
                  <div className="subfolder-tray">
                    {folder.subfolders.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className="subfolder-btn"
                        onClick={() => navigateToSubfolder(folder.id, sub.id)}
                      >
                        <span className="sub-title">{sub.name}</span>
                        <span className="sub-tag">{sub.tag}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Lively Telemetry Visualizer (Bottom-Left HUD) */}
        <div className="vault-telemetry-cluster">
          <div className="telemetry-bar-header">
            <div className="telemetry-stat-box">
              <span className="live-beacon"></span>
              <span className="telemetry-stat">5.14 GB/s</span>
            </div>
            <span className="telemetry-history">141.10 · 98.00 · 64.00 · 147.00 · 115.00</span>
          </div>

          <div className="telemetry-bars lively-eq">
            <div className="bar-wrapper" title="TODAY: 75%">
              <div className="bar p75 lively-pulse"></div>
            </div>
            <div className="bar-wrapper" title="YESTERDAY: 45%">
              <div className="bar p45"></div>
            </div>
            <div className="bar-wrapper" title="NOV 07: 30%">
              <div className="bar p30"></div>
            </div>
            <div className="bar-wrapper" title="NOV 06: 90%">
              <div className="bar p90 lively-pulse"></div>
            </div>
            <div className="bar-wrapper" title="NOV 05: 55%">
              <div className="bar p55"></div>
            </div>
            <div className="bar-wrapper" title="NOV 04: 65%">
              <div className="bar p65"></div>
            </div>
            <div className="bar-wrapper" title="NOV 03: 85%">
              <div className="bar p85"></div>
            </div>
          </div>

          <div className="telemetry-bar-footer">
            <span className="active-tag">TODAY</span>
            <span>YEST</span>
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
