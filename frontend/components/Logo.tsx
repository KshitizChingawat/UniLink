
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const Logo = ({ size = 'md', showText = true, className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <img src="/icons/unilink-192.png" alt={showText ? '' : 'UniLink'} className={`${sizeClasses[size]} shrink-0 rounded-[25%]`} />
      {showText && (
        <span className={`font-bold text-slate-900 dark:text-white ${textSizeClasses[size]}`}>
          Uni<span className="text-unilink-600 dark:text-sky-400">Link</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
