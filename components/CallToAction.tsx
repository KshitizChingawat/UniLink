
import { ArrowRight, Users } from 'lucide-react';
import DownloadButton from './DownloadButton';
import DemoVideo from './DemoVideo';

const CallToAction = () => {
  return (
    <section className="py-24 bg-gradient-to-r from-unilink-600 via-blue-600 to-purple-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Ready to connect everything?
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 leading-relaxed">
            Join thousands of users who've revolutionized their multi-device workflow. 
            Download UniLink today and experience true seamless connectivity.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <DownloadButton 
              size="lg"
              className="bg-white text-unilink-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
            />
            
            <DemoVideo />
          </div>

          <div className="flex items-center justify-center space-x-8 text-blue-100">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>100,000+ active users</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-blue-300"></div>
            <div>Free forever</div>
            <div className="hidden sm:block w-px h-4 bg-blue-300"></div>
            <div>No credit card required</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
