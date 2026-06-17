import { Link } from 'react-router-dom';
import {
  Users, FileText, Calendar, DollarSign, Shield, Globe, CheckCircle,
  ArrowRight, ExternalLink, Award, Lightbulb, Zap, Lock,
} from 'lucide-react';

const INK = '#0F2747';      // deep navy, used as text/dark accents now
const BLUE = '#2563EB';     // logo blue, accent
const GREEN = '#1E9B47';    // logo green, deepened slightly, accent
const SLATE = '#475569';    // body copy
const HAIRLINE = '#E2E8F0'; // dividers
const PAPER = '#FAFBFC';    // section background

const FEATURES = [
  { icon: Users, title: 'Employee Management', description: 'Comprehensive employee records with custom fields, documents, education history, and dependents — all in one place.' },
  { icon: DollarSign, title: 'Payroll Processing', description: 'Automated monthly payroll runs with detailed salary slips, allowances, deductions, and full breakdown by employee.' },
  { icon: Calendar, title: 'Leave Management', description: 'Multi-type leave configuration, online requests, manager approvals, and real-time balance tracking.' },
  { icon: FileText, title: 'Document & Expiry Alerts', description: 'Proactive alerts for expiring CPR, passport, visa, and work permit documents with escalation notifications.' },
  { icon: Shield, title: 'Indemnity Calculator', description: 'GCC-compliant end-of-service gratuity calculations with scenario planning and audit-ready reports.' },
  { icon: Globe, title: 'Employee Self-Service Portal', description: 'A company-branded portal where employees can view their own profile, payslips, leave balances, and submit requests.' },
];

const VALUES = [
  { icon: Lightbulb, title: 'Innovation First', description: 'We design intelligent, scalable software tailored to real business needs.' },
  { icon: Zap, title: 'Seamless Digital Transformation', description: 'Expert consultancy ensuring smooth transitions and long-term technological success.' },
  { icon: Lock, title: 'Security & Compliance', description: 'Enterprise-grade data security with role-based access control and GCC regulatory compliance.' },
  { icon: Award, title: 'Client-Centric Approach', description: 'Deep domain expertise and a collaborative approach to every project, startup to enterprise.' },
];

const GCC_COUNTRIES = [
  { code: 'BH', name: 'Bahrain' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Inter:wght@400;500;600;700;800&display=swap');
        .serif { font-family: 'Source Serif 4', Georgia, serif; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderColor: HAIRLINE }}>
        <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-3">
            <img src="/image.png" alt="HumanVerse360" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight">
              <span style={{ color: INK }}>Human</span>
              <span style={{ color: BLUE }}>Verse</span>
              <span style={{ color: GREEN }}>360</span>
            </span>
          </Link>
          <Link to="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: INK, color: '#fff', borderRadius: '4px' }}>
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 py-24 overflow-hidden" style={{
        background: 'linear-gradient(165deg, #E4EBF5 0%, #EEF2F9 45%, #F6F8FB 100%)',
      }}>
        {/* soft curved highlight, echoes reference */}
        <div className="absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)' }} />
        <div className="absolute top-10 right-0 w-[360px] h-[360px] rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, #DCE6F4 0%, rgba(220,230,244,0) 70%)' }} />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <img src="/image.png" alt="HumanVerse360" className="w-24 h-24 object-contain mx-auto mb-8" />

          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-10" style={{ background: 'rgba(15,39,71,0.18)' }} />
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: SLATE }}>
              HR &amp; Payroll Platform for the GCC
            </p>
            <div className="h-px w-10" style={{ background: 'rgba(15,39,71,0.18)' }} />
          </div>

          <h1 className="serif text-[2.75rem] sm:text-6xl font-semibold leading-[1.08] mb-7 max-w-3xl mx-auto" style={{ color: INK }}>
            HR &amp; payroll infrastructure, built for GCC compliance.
          </h1>

          <p className="text-lg leading-relaxed mb-12 max-w-2xl mx-auto" style={{ color: SLATE }}>
            HumanVerse360 brings employee records, payroll, leave, and statutory compliance into a single
            system of record — purpose-built for businesses operating across the Gulf.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-16 justify-center">
            <Link to="/register"
              className="px-7 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90 text-center"
              style={{ background: GREEN, color: '#fff', borderRadius: '4px' }}>
              Register Your Company
            </Link>
            <Link to="/login"
              className="px-7 py-3.5 text-sm font-semibold transition-colors text-center"
              style={{ background: 'transparent', border: `1px solid ${BLUE}`, color: BLUE, borderRadius: '4px' }}>
              Sign In
            </Link>
          </div>

          {/* Compliance ledger strip — signature element */}
          <div className="border-t pt-6 text-left" style={{ borderColor: 'rgba(15,39,71,0.12)' }}>
            <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-4 text-center" style={{ color: '#94A3B8' }}>
              Regulatory coverage across six jurisdictions
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-3 justify-center">
              {GCC_COUNTRIES.map(c => (
                <div key={c.code} className="flex items-center gap-2.5">
                  <span className="text-xs font-bold tracking-wider px-1.5 py-0.5"
                    style={{ color: BLUE, border: `1px solid ${BLUE}`, borderRadius: '3px', fontFamily: 'monospace' }}>
                    {c.code}
                  </span>
                  <span className="text-sm" style={{ color: SLATE }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What is HumanVerse360 */}
      <section className="py-24 px-6" style={{ background: '#fff' }}>
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-16">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: BLUE }}>About the Platform</p>
            <h2 className="serif text-3xl font-semibold mb-5" style={{ color: INK }}>Everything your HR team needs, in one record</h2>
            <p className="leading-relaxed" style={{ color: SLATE }}>
              HumanVerse360 is the flagship product of Innovegic Consultancy &amp; IT Services Co W.L.L —
              a cloud platform that consolidates onboarding, payroll, leave, and self-service into a single
              system, built for the realities of running HR across the Gulf.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: HAIRLINE }}>
            {FEATURES.map(f => (
              <div key={f.title} className="p-7 bg-white">
                <f.icon className="w-5 h-5 mb-5" style={{ color: BLUE }} strokeWidth={1.75} />
                <h3 className="font-semibold mb-2" style={{ color: INK }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: SLATE }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why HumanVerse360 */}
      <section className="py-24 px-6" style={{ background: PAPER, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: GREEN }}>Why HumanVerse360</p>
              <h2 className="serif text-3xl font-semibold mb-6" style={{ color: INK }}>Built specifically for GCC businesses</h2>
              <p className="leading-relaxed mb-8" style={{ color: SLATE }}>
                HumanVerse360 was designed from the ground up with GCC regulatory requirements in mind.
                From GOSI and GPSSA compliance to indemnity calculations under local labor laws,
                the platform handles the complexities so your team doesn't have to.
              </p>
              <div className="space-y-4">
                {[
                  'Multi-country GCC support with country-specific ID formats',
                  'Role-based access control — Admin, IT Admin, HR, Manager, Viewer',
                  'Company-branded Employee Self-Service portal',
                  'Automated leave balance sync and payroll trigger',
                  'Secure document storage with expiry alerts',
                  'Full audit trail and data export capabilities',
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GREEN }} strokeWidth={2} />
                    <span className="text-sm" style={{ color: SLATE }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats block */}
            <div className="grid grid-cols-2 gap-4 content-start">
              {[
                { value: '6', unit: 'GCC Countries', desc: 'Bahrain, Saudi Arabia, UAE, Qatar, Kuwait & Oman' },
                { value: '5', unit: 'User Roles', desc: 'Admin, IT Admin, Manager, HR, Viewer' },
                { value: '∞', unit: 'Employees', desc: 'Scale from 10 to thousands on our Enterprise plan' },
                { value: '360°', unit: 'HR Coverage', desc: 'From hire to retire, every step covered' },
              ].map(s => (
                <div key={s.unit} className="bg-white p-6" style={{ border: `1px solid ${HAIRLINE}` }}>
                  <p className="serif text-4xl font-semibold mb-1" style={{ color: INK }}>{s.value}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: BLUE }}>{s.unit}</p>
                  <p className="text-xs leading-snug" style={{ color: '#94A3B8' }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Innovegic */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mb-14">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: '#B45309' }}>The Company Behind It</p>
            <h2 className="serif text-3xl font-semibold mb-5" style={{ color: INK }}>Innovegic Consultancy &amp; IT Services Co W.L.L</h2>
            <p className="leading-relaxed" style={{ color: SLATE }}>
              HumanVerse360 is the flagship product of Innovegic — a technology company founded on a
              passion for building intelligent software that drives real business outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            <div className="space-y-px" style={{ background: HAIRLINE }}>
              <div className="p-7 bg-white">
                <h3 className="font-semibold text-base mb-3" style={{ color: INK }}>Who We Are</h3>
                <p className="text-sm leading-relaxed" style={{ color: SLATE }}>
                  At Innovegic, we specialize in delivering cutting-edge software solutions and strategic
                  IT consultancy that drive business success. We help organizations streamline operations,
                  enhance efficiency, and scale confidently in the digital age.
                </p>
              </div>
              <div className="p-7 bg-white">
                <h3 className="font-semibold text-base mb-3" style={{ color: INK }}>Our Mission</h3>
                <p className="text-sm leading-relaxed" style={{ color: SLATE }}>
                  To design intelligent, scalable software tailored to unique business needs, with expert
                  consultancy that ensures seamless digital transformation and long-term success. Whether
                  you're a startup or an enterprise, we tailor solutions that are robust, scalable, and future-ready.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-base mb-5" style={{ color: INK }}>Our Core Values</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px" style={{ background: HAIRLINE }}>
                {VALUES.map(v => (
                  <div key={v.title} className="p-5 bg-white">
                    <v.icon className="w-4 h-4 mb-3" style={{ color: BLUE }} strokeWidth={1.75} />
                    <p className="text-sm font-semibold mb-1" style={{ color: INK }}>{v.title}</p>
                    <p className="text-xs leading-snug" style={{ color: SLATE }}>{v.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="p-10" style={{ background: PAPER, border: `1px solid ${HAIRLINE}` }}>
            <h3 className="font-semibold text-base mb-6 text-center" style={{ color: INK }}>What Innovegic Offers</h3>
            <div className="flex flex-wrap justify-center gap-2.5 mb-7">
              {['Web Design', 'Software Development', 'UI/UX Design', 'IT Consultancy', 'Graphic Design', 'SEO & Online Marketing', 'Digital Transformation', 'Custom Software'].map(s => (
                <span key={s} className="px-4 py-2 text-xs font-medium bg-white"
                  style={{ color: INK, border: `1px solid ${HAIRLINE}`, borderRadius: '3px' }}>{s}</span>
              ))}
            </div>
            <div className="text-center">
              <a href="https://www.innovegicit.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
                style={{ color: BLUE }}>
                Visit innovegicit.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6" style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${GREEN} 100%)` }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="serif text-3xl font-semibold text-white mb-5">Ready to transform your HR operations?</h2>
          <p className="mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Join businesses across the GCC who trust HumanVerse360 to manage their most important asset — their people.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="px-8 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#fff', color: INK, borderRadius: '4px' }}>
              Get Started Free
            </Link>
            <Link to="/login"
              className="px-8 py-3.5 text-sm font-semibold transition-colors"
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: '4px' }}>
              Sign In to Your Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6" style={{ background: `linear-gradient(135deg, #0B1E3A 0%, #0C2B1C 100%)` }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <img src="/image.png" alt="HumanVerse360" className="w-7 h-7 object-contain opacity-80" />
            <span className="font-bold text-base">
              <span className="text-white">Human</span>
              <span style={{ color: '#7DC8FF' }}>Verse</span>
              <span style={{ color: '#6EE7A0' }}>360</span>
            </span>
          </div>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
            A product of{' '}
            <a href="https://www.innovegicit.com" target="_blank" rel="noopener noreferrer"
              className="hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Innovegic Consultancy &amp; IT Services Co W.L.L
            </a>
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            &copy; {new Date().getFullYear()} HumanVerse360. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
