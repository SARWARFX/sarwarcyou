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
      <div
        className="rounded-l-2xl py-2 px-1 sm:px-1.5 flex flex-col items-center gap-1.5 shadow-2xl transition-colors duration-200"
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderLeft: '1px solid var(--nav-border)',
          borderTop: '1px solid var(--nav-border)',
          borderBottom: '1px solid var(--nav-border)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className="flex flex-col items-center justify-center w-13 sm:w-15 py-2 px-1 rounded-xl transition-all duration-150 cursor-pointer"
              style={{
                backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
                color: isActive ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
              title={item.label}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4 mb-0.5" />
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
