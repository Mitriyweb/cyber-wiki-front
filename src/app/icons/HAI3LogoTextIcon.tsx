import React from 'react';

/**
 * CyberWiki Logo Text
 * App-level branding text used by Menu layout component
 */
export const HAI3LogoTextIcon: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span className={`font-bold text-sm leading-none ${className}`}>
      <span className="text-primary">Cyber</span>
      <span>Wiki</span>
    </span>
  );
};
