import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { BookOpen, LifeBuoy, Mail, Users } from 'lucide-react';

const supportItems = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Read setup steps, security details, and feature guides.',
    action: { label: 'Read Docs', href: '/product' },
  },
  {
    icon: LifeBuoy,
    title: 'Help Center',
    description: 'Find answers for login, sync, devices, and transfers.',
    action: { label: 'Get Help', href: 'mailto:support@unilink.app?subject=UniLink%20Help' },
  },
  {
    icon: Mail,
    title: 'Contact',
    description: 'Reach the UniLink support team directly by email.',
    action: { label: 'Email Us', href: 'mailto:support@unilink.app' },
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Share feedback and ideas with the UniLink community.',
    action: { label: 'Join Community', href: 'https://github.com/KshitizChingawat/UniLink' },
  },
];

const Support = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section className="pt-28 pb-16 bg-gradient-to-r from-slate-900 via-blue-900 to-unilink-700">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white">Support Center</h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
            Everything you need to get UniLink running smoothly across devices.
          </p>
        </div>
      </section>
      <section className="py-20">
        <div className="container mx-auto grid gap-6 px-4 md:grid-cols-2">
          {supportItems.map((item) => {
            const Icon = item.icon;
            const external = item.action.href.startsWith('http') || item.action.href.startsWith('mailto');
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-5 inline-flex rounded-2xl bg-unilink-50 p-4 text-unilink-600">
                  <Icon className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-slate-600">{item.description}</p>
                <Button asChild className="mt-6 bg-unilink-600 hover:bg-unilink-700">
                  <a href={item.action.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
                    {item.action.label}
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Support;
