
import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DemoVideo = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      {/* Demo Video Trigger */}
      <Button
        onClick={() => setIsVideoOpen(true)}
        variant="outline"
        size="lg"
        className="border-white text-white hover:bg-white hover:text-unilink-600 px-8 py-4 text-lg"
      >
        <Play className="mr-2 h-5 w-5" />
        Watch Demo
      </Button>

      {/* Video Modal */}
      {isVideoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full">
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden">
              {/* Demo Video Content */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-unilink-600 to-blue-700">
                <div className="text-center text-white p-8">
                  <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play className="w-12 h-12 text-white ml-1" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">UniLink Demo Video</h3>
                  <p className="text-lg mb-6 max-w-2xl">
                    See how UniLink seamlessly connects all your devices in under 2 minutes. 
                    Watch file sharing, clipboard sync, and screen mirroring in action.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="bg-white bg-opacity-10 rounded-lg p-4">
                      <div className="font-semibold mb-2">🚀 Quick Setup</div>
                      <div>Connect devices in seconds</div>
                    </div>
                    <div className="bg-white bg-opacity-10 rounded-lg p-4">
                      <div className="font-semibold mb-2">📱 Multi-Platform</div>
                      <div>Works on all devices</div>
                    </div>
                    <div className="bg-white bg-opacity-10 rounded-lg p-4">
                      <div className="font-semibold mb-2">🔒 Secure</div>
                      <div>End-to-end encryption</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Simulated video placeholder */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black bg-opacity-50 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-gray-900" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">UniLink Demo</div>
                      <div className="text-gray-300 text-xs">2:15 duration</div>
                    </div>
                  </div>
                  <div className="text-white text-sm">Click to play demo</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DemoVideo;
