
import { Check, X, Star, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';

const Pricing = () => {
  const { user, subscribeToPro } = useAuth();
  const [, navigate] = useLocation();
  const proActive = user?.plan === 'pro' && (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() > Date.now());
  const proExpiryLabel = user?.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
    : '';

  const plans = [
    {
      name: "Free",
      price: "₹0",
      period: "forever",
      description: "Perfect for personal use with basic connectivity",
      features: [
        "Connect 1 device",
        "Share files up to 100 MB",
        "Clipboard sync",
        "Standard support",
        "Local network sync"
      ],
      limitations: [
        "Remote access",
        "Advanced security features",
        "Priority support",
        "Team collaboration"
      ],
      popular: false,
      buttonText: "Get Started Free",
      buttonVariant: "outline" as const
    },
    {
      name: "Pro",
      price: "₹100",
      period: "per month",
      description: "Unlimited devices with advanced features",
      features: [
        "Unlimited devices",
        "Share files up to 10 GB",
        "Real-time clipboard sync",
        "Screen mirroring",
        "Remote device control",
        "Notification sync",
        "Priority support",
        "Advanced security",
        "Team collaboration",
        "Cloud backup"
      ],
      limitations: [],
      popular: true,
      buttonText: proActive ? "Renew Pro" : "Upgrade to Pro",
      buttonVariant: "default" as const
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact us",
      description: "Custom solutions for large organizations",
      features: [
        "Everything in Pro",
        "Custom deployment",
        "Advanced admin controls",
        "SSO integration",
        "Dedicated support",
        "SLA guarantee",
        "Custom integrations",
        "Advanced analytics"
      ],
      limitations: [],
      popular: false,
      buttonText: "Contact Sales",
      buttonVariant: "outline" as const
    }
  ];

  const handlePlanAction = async (planName: string) => {
    if (planName === 'Pro') {
      if (!user) {
        navigate('/login');
        return;
      }

      if (proActive) {
        await subscribeToPro();
        return;
      }

      await subscribeToPro();
      return;
    }

    if (planName === 'Free') {
      navigate(user ? '/dashboard/files' : '/login');
      return;
    }

    window.location.href = 'mailto:support@unilink.app?subject=UniLink Enterprise';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-r from-unilink-600 to-blue-700 dark:from-slate-900 dark:to-slate-950 transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">
            Start free and upgrade when you need to connect more devices. 
            No hidden fees, cancel anytime.
          </p>
          <p className="mt-4 text-sm text-blue-100/90">
            Free users can share up to 100 MB. Pro users can share up to 10 GB while the subscription is active.
          </p>
          {proActive ? (
            <div className="mt-6 inline-flex items-center rounded-full bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-300/40">
              <Crown className="mr-2 h-4 w-4" />
              Pro active until {proExpiryLabel}
            </div>
          ) : null}
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div key={index} className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-lg border-2 p-8 transition-all duration-300 ${
                plan.popular ? 'border-unilink-500 scale-105' : 'border-gray-200 dark:border-slate-800'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-unilink-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center">
                      <Star className="w-4 h-4 mr-1" />
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center mb-2">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    {plan.period !== "contact us" && (
                      <span className="text-gray-500 dark:text-slate-400 ml-1">/{plan.period}</span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-slate-300">{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-slate-200">{feature}</span>
                    </div>
                  ))}
                  {plan.limitations.map((limitation, limitIndex) => (
                    <div key={limitIndex} className="flex items-center opacity-50">
                      <X className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                      <span className="text-gray-500 dark:text-slate-500">{limitation}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className={`w-full ${plan.popular ? 'bg-unilink-600 hover:bg-unilink-700' : ''}`}
                  variant={plan.buttonVariant}
                  size="lg"
                  onClick={() => handlePlanAction(plan.name)}
                >
                  {plan.buttonText}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-8">
            {[
              {
                question: "Can I change plans anytime?",
                answer: "Yes! You can upgrade your plan at any time. Changes take effect immediately."
              },
              {
                question: "How much can I share on each plan?",
                answer: "Free accounts can share files up to 100 MB. Pro accounts can share up to 10 GB while the monthly subscription is active."
              },
              {
                question: "What happens if I exceed the device limit?",
                answer: "On the free plan, you can only connect 1 device. To connect more devices, you'll need to upgrade to Pro."
              },
              {
                question: "Is there a free trial for Pro?",
                answer: "Yes! We offer a 14-day free trial of Pro with all features included. No credit card required."
              },
              {
                question: "Do you offer refunds?",
                answer: "Yes, we offer a 30-day money-back guarantee for all paid plans if you're not satisfied."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white dark:bg-slate-950 rounded-lg p-6 shadow-sm border border-transparent dark:border-slate-800 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{faq.question}</h3>
                <p className="text-gray-600 dark:text-slate-300">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
