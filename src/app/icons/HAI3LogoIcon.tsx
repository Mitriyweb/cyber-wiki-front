import React from 'react';

/**
 * CyberWiki Logo Icon
 * App-level branding icon used by Menu layout component
 */
export const HAI3LogoIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect width="32" height="32" rx="6" className="fill-primary"/>
      <text x="16" y="22" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="700" fontSize="18" fill="white">CW</text>
    </svg>
  );
};
