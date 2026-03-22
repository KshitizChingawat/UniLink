
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import CompatibilitySection from '@/components/CompatibilitySection';
import CallToAction from '@/components/CallToAction';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-slate-950 dark:text-white transition-colors duration-300">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <CompatibilitySection />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
