
import { memo } from 'react';
import { Smartphone, Monitor, Laptop, Tablet, Watch } from 'lucide-react';

const devices = [
  { Icon: Monitor, name: 'Windows', position: 'top-0 left-1/2 transform -translate-x-1/2', delay: '0s' },
  { Icon: Laptop, name: 'macOS', position: 'top-20 right-0', delay: '0.5s' },
  { Icon: Smartphone, name: 'Android', position: 'bottom-20 right-0', delay: '1s' },
  { Icon: Tablet, name: 'iOS', position: 'bottom-0 left-1/2 transform -translate-x-1/2', delay: '1.5s' },
  { Icon: Watch, name: 'Linux', position: 'top-20 left-0', delay: '2s' },
];

const DeviceAnimation = () => {
  return (
    <div className="relative mx-auto h-80 w-80 select-none">
      {/* Central hub */}
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-unilink-500 to-unilink-700 animate-pulse-glow">
        <div className="w-8 h-8 bg-white rounded-full"></div>
      </div>

      {/* Connection lines */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="device-connection-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {devices.map((device) => (
          <g key={device.name}>
            <line
              x1="50%"
              y1="50%"
              x2={device.position.includes('right') ? '85%' : device.position.includes('left') ? '15%' : '50%'}
              y2={device.position.includes('top') ? '15%' : device.position.includes('bottom') ? '85%' : '50%'}
              stroke="url(#device-connection-gradient)"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="opacity-80"
            />
          </g>
        ))}
      </svg>

      {/* Device icons */}
      {devices.map((device, index) => {
        const { Icon } = device;
        return (
          <div
            key={index}
            className={`absolute ${device.position} w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center animate-float border-2 border-unilink-200`}
            style={{ animationDelay: device.delay }}
          >
            <Icon className="w-6 h-6 text-unilink-600" />
          </div>
        );
      })}
    </div>
  );
};

export default memo(DeviceAnimation);
