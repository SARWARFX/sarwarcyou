import React from 'react';
import { hapticMedium } from '../../utils/hapticsManager';

export interface SectorRadarRailProps {
  activeSector: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY';
  onNavigateSector: (sector: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY') => void;
}

const SECTORS = [
  { id: 'SHORTS', code: '01', name: 'SHORTS' },
  { id: 'CLIPS', code: '02', name: 'CLIPS' },
  { id: 'PHOTOGRAPHY', code: '03', name: 'PHOTOS' },
] as const;

export const SectorRadarRail: React.FC<SectorRadarRailProps> = ({
  activeSector,
  onNavigateSector,
}) => {
  return (
    <aside
      aria-label="Sector Waypoint Radar"
      className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 hidden md:flex flex-col items-end gap-4 select-none pointer-events-auto"
    >
      {/* Background Connecting Vertical Rail Track */}
      <div className="absolute right-[13px] top-3 bottom-3 w-[1.5px] bg-white/10 pointer-events-none">
        <div
          className="w-full bg-[#ccff00] transition-all duration-300 ease-out shadow-[0_0_8px_#ccff00]"
          style={{
            height: '33.3%',
            transform: `translateY(${
              activeSector === 'SHORTS'
                ? '0%'
                : activeSector === 'CLIPS'
                ? '100%'
                : '200%'
            })`,
          }}
        />
      </div>

      {SECTORS.map((sector) => {
        const isActive = activeSector === sector.id;

        return (
          <button
            key={sector.id}
            type="button"
            onClick={() => {
              hapticMedium();
              onNavigateSector(sector.id);
            }}
            title={`Scroll to Sector ${sector.code}: ${sector.name}`}
            className="group relative flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            {/* Slide-out Hover & Active Tag Pill */}
            <div
              className={`px-2 py-0.5 rounded bg-black/90 border text-[9px] font-mono font-bold tracking-widest whitespace-nowrap transition-all duration-200 shadow-xl ${
                isActive
                  ? 'border-[#ccff00] text-[#ccff00] opacity-100 translate-x-0'
                  : 'border-white/15 text-neutral-400 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0'
              }`}
            >
              SECTOR {sector.code} // {sector.name}
            </div>

            {/* Radar Node Diode */}
            <div
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-[10px] transition-all duration-200 ${
                isActive
                  ? 'bg-[#ccff00] text-black shadow-[0_0_16px_rgba(204,255,0,0.85)] scale-110'
                  : 'bg-[#0a0d14]/90 text-neutral-400 border border-white/20 hover:border-[#ccff00] hover:text-[#ccff00] hover:scale-105'
              }`}
            >
              {sector.code}
            </div>
          </button>
        );
      })}
    </aside>
  );
};

export default SectorRadarRail;
