
import { 
  Share2, 
  Copy, 
  Bell, 
  Monitor, 
  Shield, 
  Zap, 
  Wifi, 
  Smartphone 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FeaturesSection = () => {
  const features = [
    {
      Icon: Share2,
      title: 'Universal File Sharing',
      description: 'Instantly share files between any devices without cables, emails, or cloud uploads. Drag, drop, done.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      Icon: Copy,
      title: 'Smart Clipboard Sync',
      description: 'Copy on one device, paste on another. Text, images, links - everything syncs seamlessly in real-time.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      Icon: Bell,
      title: 'Unified Notifications',
      description: 'Receive and respond to notifications from all your devices in one place. Never miss important messages.',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      Icon: Monitor,
      title: 'Screen Mirroring',
      description: 'Mirror your phone screen to your computer or control your desktop from your tablet with zero lag.',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      Icon: Smartphone,
      title: 'Remote Control',
      description: 'Use your phone as a trackpad, keyboard, or remote control for any connected device.',
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      Icon: Wifi,
      title: 'Auto Device Discovery',
      description: 'Devices automatically find and connect to each other on the same network. Setup takes seconds.',
      gradient: 'from-teal-500 to-blue-500'
    },
    {
      Icon: Shield,
      title: 'End-to-End Encryption',
      description: 'Military-grade encryption ensures your data stays private. Only your devices can decrypt the connection.',
      gradient: 'from-gray-500 to-slate-600'
    },
    {
      Icon: Zap,
      title: 'Lightning Fast',
      description: 'Built for speed with modern protocols. Transfer gigabytes in seconds, not minutes.',
      gradient: 'from-yellow-500 to-orange-500'
    }
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Everything you need for 
            <span className="bg-gradient-to-r from-unilink-600 to-purple-600 bg-clip-text text-transparent"> seamless connectivity</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            UniLink bridges the gap between your devices with powerful features designed for the modern multi-device lifestyle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const { Icon } = feature;
            return (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 overflow-hidden">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.gradient} p-3 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
