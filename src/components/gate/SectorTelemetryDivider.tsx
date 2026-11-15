import React from 'react';

export interface SectorTelemetryDividerProps {
  sectorNumber: '02' | '03';
  sectorTitle: string;
  subtitle: string;
  telemetryTags?: string[];
}

export const SectorTelemetryDivider: React.FC<SectorTelemetryDividerProps> = ({
  sectorNumber,
  sectorTitle,
  subtitle,
  telemetryTags = ['BUFFER: SYNCHRONIZED', 'LATENCY: 0.12ms', 'VERIFIED 4K'],
}) => {
  return (
    <div className="w-full py-6 sm:py-7 px-4 sm:px-8 border-y border-white/[0.08] bg-gradient-to-r from-transparent via-[#ccff00]/[0.03] to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono select-none my-4">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <span className="px-2 py-0.5 rounded bg-[#ccff00]/15 border border-[#ccff00]/40 text-[#ccff00] text-[10px] font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(204,255,0,0.2)] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse" />
          SECTOR {sectorNumber} // {sectorTitle}
        </span>
        <span className="text-xs text-neutral-400 tracking-wider font-sans">
          {subtitle}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-neutral-500 tracking-widest">
        {telemetryTags.map((tag, idx) => (
          <React.Fragment key={tag}>
            {idx > 0 && <span className="text-neutral-700">•</span>}
            <span className={idx === telemetryTags.length - 1 ? 'text-[#ccff00] font-bold' : ''}>
              {tag}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default SectorTelemetryDivider;
