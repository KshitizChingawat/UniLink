
import { useState } from 'react';
import { Download, CheckCircle, Smartphone, Monitor, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DownloadButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const DownloadButton = ({ variant = "default", size = "default", className = "" }: DownloadButtonProps) => {
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const downloadOptions = [
    {
      platform: "Windows",
      icon: Monitor,
      version: "v2.1.0",
      size: "45 MB",
      url: "#windows-download"
    },
    {
      platform: "macOS",
      icon: Laptop,
      version: "v2.1.0",
      size: "52 MB",
      url: "#macos-download"
    },
    {
      platform: "Linux",
      icon: Monitor,
      version: "v2.1.0",
      size: "38 MB",
      url: "#linux-download"
    },
    {
      platform: "Android",
      icon: Smartphone,
      version: "v2.1.0",
      size: "28 MB",
      url: "#android-download"
    },
    {
      platform: "iOS",
      icon: Smartphone,
      version: "v2.1.0",
      size: "32 MB",
      url: "#ios-download"
    }
  ];

  const handleDownload = async (platform: string, url: string) => {
    setDownloading(true);
    
    // Simulate download process
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
      
      // Create a temporary download link
      const link = document.createElement('a');
      link.href = '#'; // In a real app, this would be the actual download URL
      link.download = `UniLink-${platform}-v2.1.0.exe`; // Simulated filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Show success message
      setTimeout(() => {
        setDownloaded(false);
        setShowDownloadOptions(false);
      }, 2000);
    }, 1500);
  };

  if (downloaded) {
    return (
      <Button variant={variant} size={size} className={`${className} bg-green-600 hover:bg-green-700`}>
        <CheckCircle className="mr-2 h-5 w-5" />
        Downloaded!
      </Button>
    );
  }

  if (downloading) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
        Downloading...
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowDownloadOptions(!showDownloadOptions)}
      >
        <Download className="mr-2 h-5 w-5" />
        Download Free
      </Button>

      {showDownloadOptions && (
        <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-80 z-50">
          <h3 className="font-semibold text-gray-900 mb-3">Choose your platform</h3>
          <div className="space-y-2">
            {downloadOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.platform}
                  onClick={() => handleDownload(option.platform, option.url)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-unilink-100 rounded-lg flex items-center justify-center mr-3">
                      <Icon className="w-5 h-5 text-unilink-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{option.platform}</div>
                      <div className="text-sm text-gray-500">{option.version} • {option.size}</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Free forever • No credit card required • Instant setup
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadButton;
