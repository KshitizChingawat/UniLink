import { Button } from '@/components/ui/button';
import { Play, Download, ArrowRight } from 'lucide-react';
import DeviceAnimation from './DeviceAnimation';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-unilink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-glow"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse-glow delay-1000"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="animate-slide-in">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              One Link.{' '}
              <span className="bg-gradient-to-r from-unilink-600 to-purple-600 bg-clip-text text-unilink-600">
                Every Device.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
              Revolutionary cross-platform connectivity that seamlessly syncs files, clipboard, 
              notifications, and device control across Windows, macOS, Linux, Android, and iOS.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button size="lg" className="bg-unilink-600 hover:bg-unilink-700 text-white px-8 py-4 text-lg">
                <Download className="mr-2 h-5 w-5" />
                Download Free
              </Button>
              
              <Button size="lg" variant="outline" className="border-unilink-600 text-unilink-600 hover:bg-unilink-50 px-8 py-4 text-lg">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            <div className="flex items-center justify-center text-sm text-gray-500 mb-16">
              <span>Trusted by 100,000+ users worldwide</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </div>
          </div>

          <div className="relative">
            <DeviceAnimation />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;