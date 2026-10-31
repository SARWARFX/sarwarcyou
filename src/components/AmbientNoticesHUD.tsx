import React, { useState, useEffect } from 'react';

const NOTICES: { prefix: string; email: string; suffix: string }[] = [
  {
    prefix: 'Encountering issues? Reach out to ',
    email: 'contact@sarwar.cyou',
    suffix: '',
  },
  {
    prefix: 'Need assistance? Contact ',
    email: 'support@sarwar.cyou',
    suffix: '',
  },
  {
    prefix: 'Want your media featured? Email a public Google Drive link to ',
    email: 'publisher@sarwar.cyou',
    suffix: ' for editorial review.',
  },
];

export interface AmbientNoticesHUDProps {
  className?: string;
  style?: React.CSSProperties;
}

export const AmbientNoticesHUD: React.FC<AmbientNoticesHUDProps> = ({ className = '', style }) => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % NOTICES.length);
        setFade(true);
      }, 400); // 400ms cross-fade animation
    }, 9000); // 9 second cycle (within 8-10 seconds spec)

    return () => clearInterval(timer);
  }, []);

  const current = NOTICES[index];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto select-text font-mono text-xs text-white/90 max-w-sm sm:max-w-md ${className}`}
      style={{
        background: 'rgba(4, 7, 15, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderLeft: '2px solid #00f0ff',
        borderRadius: '4px',
        padding: '8px 14px',
        textShadow: '0 1px 4px #000, 0 0 8px #000',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        ...style,
      }}
    >
      <div
        className={`transition-all duration-400 ease-in-out flex items-center gap-2 ${
          fade ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse flex-shrink-0" />
        <span className="leading-relaxed">
          {current.prefix}
          <a
            href={`mailto:${current.email}`}
            className="text-[#00f0ff] hover:underline font-semibold transition-colors"
          >
            {current.email}
          </a>
          {current.suffix}
        </span>
      </div>
    </div>
  );
};

export default AmbientNoticesHUD;
