import { memo } from 'react';
import { Laptop, Monitor, MonitorSmartphone, Smartphone, Tablet } from 'lucide-react';

const devices = [
  { Icon: Monitor, x: 50, y: 11 },
  { Icon: Laptop, x: 88, y: 39 },
  { Icon: Smartphone, x: 74, y: 84 },
  { Icon: Tablet, x: 26, y: 84 },
  { Icon: MonitorSmartphone, x: 12, y: 39 },
];

function DeviceAnimation() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-80 select-none">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full fill-none text-blue-400">
        <circle cx="50" cy="50" r="39" stroke="currentColor" strokeWidth=".35" opacity=".5" />
        <circle cx="50" cy="50" r="23" stroke="currentColor" strokeWidth=".35" opacity=".35" />
        {devices.map(({ x, y }) => (
          <line key={x} x1="50" y1="50" x2={x} y2={y} stroke="currentColor" strokeWidth=".65" strokeDasharray="1.5 1.5" />
        ))}
      </svg>
      {devices.map(({ Icon, x, y }) => (
        <div key={x} style={{ left: x + '%', top: y + '%' }} className="absolute grid h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-blue-200 bg-white text-blue-700 shadow-md">
          <Icon className="h-1/2 w-1/2" />
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 rounded-[25%] bg-blue-400 opacity-25 motion-safe:animate-ping" />
        <img src="/icons/unilink-192.png" alt="" className="relative h-full w-full rounded-[25%] shadow-lg" />
      </div>
    </div>
  );
}

export default memo(DeviceAnimation);
