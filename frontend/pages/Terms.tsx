import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section className="pt-28 pb-16 bg-slate-950 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-bold">Terms of Service</h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            UniLink is provided to help users securely connect their devices, manage transfers, and sync content responsibly.
          </p>
        </div>
      </section>
      <section className="container mx-auto px-4 py-16 text-slate-700">
        <div className="max-w-3xl space-y-5">
          <p>Use UniLink only with devices and data you own or are authorized to access.</p>
          <p>Keep your credentials safe and avoid sharing secure vault content with unauthorized users.</p>
          <p>Transfers, clipboard sync, and device links are designed for productivity and collaboration.</p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Terms;
