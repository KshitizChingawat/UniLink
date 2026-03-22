import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section className="pt-28 pb-16 bg-gradient-to-r from-slate-900 to-unilink-700 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold">Privacy Policy</h1>
          <p className="mt-4 max-w-3xl text-slate-200">
            UniLink stores your account and sync data only to power your connected-device experience.
          </p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 text-slate-700">
        <div className="max-w-3xl space-y-5">
          <p>Your account session is stored locally in your browser for sign-in continuity.</p>
          <p>Secure vault entries are encrypted before storage, and your remembered email is stored only when you opt in.</p>
          <p>You can clear local settings and profile data anytime from the dashboard settings screen.</p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Privacy;
