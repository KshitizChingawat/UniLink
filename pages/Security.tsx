
import { Shield, Lock, Eye, Key, Server, CheckCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Security = () => {
  const securityFeatures = [
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All data transfers are protected with AES-256 encryption, ensuring your files and information remain private."
    },
    {
      icon: Shield,
      title: "Zero-Knowledge Architecture",
      description: "We never store your data on our servers. Everything is processed locally on your devices."
    },
    {
      icon: Key,
      title: "Secure Authentication",
      description: "Multi-factor authentication and device verification ensure only you can access your connected devices."
    },
    {
      icon: Eye,
      title: "Privacy First",
      description: "No tracking, no analytics, no data collection. Your privacy is our top priority."
    },
    {
      icon: Server,
      title: "Local Network Priority",
      description: "When possible, devices communicate directly over your local network for maximum security."
    },
    {
      icon: CheckCircle,
      title: "Regular Security Audits",
      description: "Our security practices are regularly audited by third-party security firms."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-r from-unilink-600 to-blue-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Bank-Level Security
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Your data security is our highest priority. UniLink uses military-grade encryption 
            and zero-knowledge architecture to keep your information safe.
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {securityFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                  <div className="w-12 h-12 bg-unilink-100 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-unilink-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Standards */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-12">Security Standards & Compliance</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {['SOC 2 Type II', 'ISO 27001', 'GDPR Compliant', 'CCPA Compliant'].map((standard, index) => (
              <div key={index} className="bg-white rounded-lg p-6 shadow-md">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{standard}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Security;
