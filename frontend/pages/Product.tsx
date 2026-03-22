import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Download, Rocket, ScrollText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Product = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section className="pt-28 pb-16 bg-gradient-to-r from-unilink-600 via-blue-700 to-indigo-900">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white">Product Hub</h1>
          <p className="mt-4 text-lg text-blue-100 max-w-3xl mx-auto">
            Explore UniLink features, release notes, and download guidance in one place.
          </p>
        </div>
      </section>
      <section className="py-20">
        <div className="container mx-auto grid gap-6 px-4 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: 'Features',
              description: 'Cross-platform sync, clipboard sharing, secure vault, and smart transfers.',
            },
            {
              icon: Download,
              title: 'Download',
              description: 'Desktop and mobile builds are represented in the unified download picker across the site.',
            },
            {
              icon: ScrollText,
              title: 'Changelog',
              description: 'Latest update: polished auth flow, backend APIs, working dashboard routes, and smoother interactions.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="mb-4 inline-flex rounded-2xl bg-unilink-50 p-4 text-unilink-600">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </div>
        <div className="container mx-auto px-4 pt-12 text-center">
          <Button asChild size="lg" className="bg-unilink-600 hover:bg-unilink-700">
            <a href="/pricing">
              <Rocket className="mr-2 h-5 w-5" />
              View Pricing
            </a>
          </Button>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Product;
