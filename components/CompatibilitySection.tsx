
import { 
  Monitor, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Watch,
  CheckCircle
} from 'lucide-react';

const CompatibilitySection = () => {
  const platforms = [
    {
      Icon: Monitor,
      name: 'Windows',
      versions: ['Windows 10', 'Windows 11'],
      color: 'bg-blue-500'
    },
    {
      Icon: Laptop,
      name: 'macOS',
      versions: ['macOS 11+', 'Intel & Apple Silicon'],
      color: 'bg-gray-700'
    },
    {
      Icon: Smartphone,
      name: 'Android',
      versions: ['Android 8.0+', 'All manufacturers'],
      color: 'bg-green-500'
    },
    {
      Icon: Tablet,
      name: 'iOS/iPadOS',
      versions: ['iOS 14+', 'iPadOS 14+'],
      color: 'bg-blue-600'
    },
    {
      Icon: Watch,
      name: 'Linux',
      versions: ['Ubuntu', 'Debian', 'Fedora', 'Arch'],
      color: 'bg-orange-500'
    }
  ];

  const benefits = [
    'Works across all your devices instantly',
    'No platform restrictions or limitations',
    'Same features on every operating system',
    'Regular updates for all platforms',
    'One account, unlimited devices'
  ];

  return (
    <section id="compatibility" className="py-24 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            True <span className="bg-gradient-to-r from-unilink-600 to-purple-600 bg-clip-text text-transparent">Universal</span> Compatibility
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            The only cross-platform solution that works seamlessly across every major operating system and device type.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-16">
          {platforms.map((platform, index) => {
            const { Icon } = platform;
            return (
              <div key={index} className="text-center group">
                <div className={`w-20 h-20 ${platform.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <Icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{platform.name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  {platform.versions.map((version, vIndex) => (
                    <div key={vIndex}>{version}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why Universal Matters</h3>
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompatibilitySection;
