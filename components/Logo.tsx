
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
      <div className={`${sizeClasses[size]} relative`}>
        {/* Outer ring representing connectivity */}
        <div className="absolute inset-0 rounded-full border-3 border-gradient-to-r from-unilink-500 to-unilink-700 animate-pulse">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-unilink-500 via-blue-500 to-purple-600 p-1">
            {/* Inner circle representing unified connection */}
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              {/* Connection nodes */}
              <div className="relative w-6 h-6">
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-unilink-600 rounded-full"></div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-unilink-600 rounded-full"></div>
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-unilink-600 rounded-full"></div>
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-unilink-600 rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-unilink-600 to-unilink-700 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showText && (
        <span className={`font-bold text-gray-900 ${textSizeClasses[size]}`}>
          Uni<span className="text-unilink-600">Link</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
