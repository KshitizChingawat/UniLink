import React, { useState } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedToggleProps {
  onToggle?: (isConnected: boolean) => void;
  className?: string;
}

const AnimatedToggle = ({ onToggle, className }: AnimatedToggleProps) => {
  const [isConnected, setIsConnected] = useState(false);

  const handleToggle = () => {
    const newState = !isConnected;
    setIsConnected(newState);
    onToggle?.(newState);
  };

  return (
    <div className={cn("flex items-center justify-center p-6", className)}>
      <div className="relative flex items-center space-x-16">
        {/* Mobile Icon */}
        <div 
          className={`relative transition-all duration-500 ${
            isConnected ? 'scale-110 text-unilink-600' : 'text-gray-400'
          }`}
        >
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
            isConnected 
              ? 'border-unilink-500 bg-unilink-50 shadow-lg' 
              : 'border-gray-300 bg-gray-50'
          }`}>
            <Smartphone className="w-8 h-8" />
          </div>
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
          )}
        </div>

        {/* Connection Line */}
        <div className="absolute left-16 right-16 top-1/2 transform -translate-y-1/2 h-0.5 overflow-hidden">
          <div 
            className={`h-full bg-gradient-to-r from-unilink-500 to-purple-500 transition-all duration-1000 ${
              isConnected ? 'w-full opacity-100' : 'w-0 opacity-0'
            }`}
          >
            {/* Animated dots */}
            {isConnected && (
              <>
                <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-white rounded-full transform -translate-y-1/2 animate-pulse"></div>
                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full transform -translate-y-1/2 animate-pulse delay-300"></div>
                <div className="absolute top-1/2 left-3/4 w-2 h-2 bg-white rounded-full transform -translate-y-1/2 animate-pulse delay-500"></div>
              </>
            )}
          </div>
        </div>

        {/* PC Icon */}
        <div 
          className={`relative transition-all duration-500 ${
            isConnected ? 'scale-110 text-unilink-600' : 'text-gray-400'
          }`}
        >
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 ${
            isConnected 
              ? 'border-unilink-500 bg-unilink-50 shadow-lg' 
              : 'border-gray-300 bg-gray-50'
          }`}>
            <Monitor className="w-8 h-8" />
          </div>
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={handleToggle}
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-unilink-200 ${
            isConnected
              ? 'bg-unilink-600 border-unilink-600 text-white shadow-lg'
              : 'bg-white border-gray-300 text-gray-600 hover:border-unilink-400'
          }`}
        >
          <div className={`w-6 h-6 mx-auto transition-transform duration-300 ${
            isConnected ? 'rotate-180' : 'rotate-0'
          }`}>
            <div className="w-full h-full flex items-center justify-center">
              {isConnected ? (
                <div className="w-2 h-2 bg-white rounded-full"></div>
              ) : (
                <div className="w-4 h-0.5 bg-current"></div>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Status Text */}
      <div className="mt-6 text-center">
        <p className={`text-sm font-medium transition-colors duration-300 ${
          isConnected ? 'text-unilink-600' : 'text-gray-500'
        }`}>
          {isConnected ? 'Devices Connected' : 'Click to Connect'}
        </p>
        {isConnected && (
          <p className="text-xs text-gray-500 mt-1 animate-fade-in">
            Secure connection established
          </p>
        )}
      </div>
    </div>
  );
};

export default AnimatedToggle;