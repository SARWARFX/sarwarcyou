import React from 'react';
import { Home, Camera, Film, Smartphone } from 'lucide-react';
import type { CyberFilterType } from './CyberHeader';

export interface RightDockedNavProps {
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
}

interface NavItem {
  id: CyberFilterType;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'all', label: 'Home', icon: Home },
  { id: 'images', label: 'Images', icon: Camera },
  { id: 'clips', label: 'Video clips', icon: Film },
  { id: 'shorts', label: 'Shorts', icon: Smartphone },
];

export const RightDockedNav: React.FC<RightDockedNavProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  return (
    <aside
      aria-label="Media navigation"
      className="fixed right-0 top-1/2 -translate-y-1/2 z-[1000] select-none"
      style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
      }}
    >
      <div className="bg-[#000000] border-l border-y border-white/20 rounded-l-2xl shadow-[0_8px_30px_rgba(0,0,0,0.95)] py-2 px-1 sm:px-1.5 flex flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={`flex flex-col items-center justify-center w-13 sm:w-15 py-2 px-1 rounded-xl transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10'
              }`}
              title={item.label}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-black' : 'text-white'}`} />
              <span className="text-[9px] font-sans font-medium tracking-tight leading-tight text-center">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default RightDockedNav;
