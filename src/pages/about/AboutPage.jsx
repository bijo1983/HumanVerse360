import { Link } from 'react-router-dom';
import {
  Users, FileText, Calendar, DollarSign, Shield, Globe, CheckCircle,
  ArrowRight, Mail, Phone, ExternalLink, Award, Lightbulb, Zap, Lock,
} from 'lucide-react';

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

const GCC_COUNTRIES = ['Bahrain', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Kuwait', 'Oman'];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5">
            <img src="/image.png" alt="HumanVerse360" className="w-9 h-9 object-contain" />
            <span className="text-lg font-black">
              <span style={{ color: '#1B3A6E' }}>Human</span>
              <span style={{ color: '#2563EB' }}>Verse</span>
              <span style={{ color: '#3DB83F' }}>360</span>
              <span className="text-sm font-bold" style={{ color: '#2563EB' }}>.com</span>
            </span>
          </Link>
          <Link to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)' }}>
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6" style={{ background: 'linear-gradient(160deg, #0D2554 0%, #1B3A6E 55%, #0D3B20 100%)' }}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: '#3DB83F', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: '#2563EB', transform: 'translate(-30%, 30%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img src="/image.png" alt="HumanVerse360" className="w-24 h-24 object-contain drop-shadow-2xl" />
          </div>
          <h1 className="text-5xl font-black mb-3 leading-tight">
            <span style={{ color: '#ffffff' }}>Human</span>
            <span style={{ color: '#7DC8FF' }}>Verse</span>
            <span style={{ color: '#6EE7A0' }}>360</span>
            <span className="text-3xl font-bold" style={{ color: '#7DC8FF' }}>.com</span>
          </h1>
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-16" style={{ background: 'rgba(255,255,255,0.25)' }} />
            <p className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
              HR &amp; PAYROLL. SIMPLIFIED. INTELLIGENT. SECURE.
            </p>
            <div className="h-px w-16" style={{ background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <p className="text-xl leading-relaxed mb-4 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.8)' }}>
            A next-generation HR &amp; Payroll management platform purpose-built for GCC companies.
          </p>
          <p className="text-base leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.58)' }}>
            Empowering People. Streamlining Payroll.{' '}
            <span className="font-semibold" style={{ color: '#6EE7A0' }}>Driving Success—Together.</span>
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {GCC_COUNTRIES.map(c => (
              <span key={c} className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                {c}
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg, #3DB83F 0%, #22c55e 100%)', color: '#fff' }}>
              Register Your Company
            </Link>
            <Link to="/login"
              className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* What is HumanVerse360 */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#EFF6FF', color: '#2563EB' }}>About the Platform</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Everything Your HR Team Needs</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              HumanVerse360 is the latest product from Innovegic Consultancy &amp; IT Services Co W.L.L —
              an all-in-one cloud platform that eliminates HR complexity for businesses across the GCC.
              From onboarding to payroll to self-service, we've got every touchpoint covered.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors" style={{ background: '#EFF6FF' }}>
                  <f.icon className="w-5 h-5" style={{ color: '#2563EB' }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#1B3A6E' }}>{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why HumanVerse360 */}
      <section className="py-20 px-6" style={{ background: '#F8FAFC' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#F0FDF4', color: '#3DB83F' }}>Why HumanVerse360</span>
              <h2 className="text-3xl font-bold mb-5" style={{ color: '#1B3A6E' }}>Built Specifically for GCC Businesses</h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                HumanVerse360 was designed from the ground up with GCC regulatory requirements in mind.
                From GOSI and GPSSA compliance to indemnity calculations under local labor laws,
                the platform handles the complexities so your team doesn't have to.
              </p>
              <div className="space-y-3">
                {[
                  'Multi-country GCC support with country-specific ID formats',
                  'Role-based access control — Admin, IT Admin, HR, Manager, Viewer',
                  'Company-branded Employee Self-Service portal',
                  'Automated leave balance sync and payroll trigger',
                  'Secure document storage with expiry alerts',
                  'Full audit trail and data export capabilities',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#3DB83F' }} />
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats block */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '6', unit: 'GCC Countries', desc: 'Bahrain, Saudi Arabia, UAE, Qatar, Kuwait & Oman' },
                { value: '5', unit: 'User Roles', desc: 'Admin, IT Admin, Manager, HR, Viewer' },
                { value: '∞', unit: 'Employees', desc: 'Scale from 10 to thousands on our Enterprise plan' },
                { value: '360°', unit: 'HR Coverage', desc: 'From hire to retire, every step covered' },
              ].map(s => (
                <div key={s.unit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <p className="text-4xl font-black mb-1" style={{ color: '#1B3A6E' }}>{s.value}</p>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#2563EB' }}>{s.unit}</p>
                  <p className="text-xs text-gray-400 leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Innovegic */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#FEF9C3', color: '#854D0E' }}>The Company Behind It</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Innovegic Consultancy &amp; IT Services Co W.L.L</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              HumanVerse360 is the latest flagship product of Innovegic — a technology company
              founded on a passion for building intelligent software that drives real business outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-14">
            <div className="space-y-5">
              <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-lg mb-3" style={{ color: '#1B3A6E' }}>Who We Are</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  At Innovegic, we specialize in delivering cutting-edge software solutions and strategic
                  IT consultancy that drive business success. We help organizations streamline operations,
                  enhance efficiency, and scale confidently in the digital age.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-lg mb-3" style={{ color: '#1B3A6E' }}>Our Mission</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  To design intelligent, scalable software tailored to unique business needs,
                  with expert consultancy that ensures seamless digital transformation and long-term success.
                  Whether you're a startup or an enterprise, we tailor solutions that are robust, scalable, and future-ready.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-5" style={{ color: '#1B3A6E' }}>Our Core Values</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VALUES.map(v => (
                  <div key={v.title} className="p-4 rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#EFF6FF' }}>
                      <v.icon className="w-4 h-4" style={{ color: '#2563EB' }} />
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#1B3A6E' }}>{v.title}</p>
                    <p className="text-xs text-gray-500 leading-snug">{v.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #F0FDF4 100%)', border: '1px solid #E0EEFF' }}>
            <h3 className="font-semibold text-lg mb-5 text-center" style={{ color: '#1B3A6E' }}>What Innovegic Offers</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {['Web Design', 'Software Development', 'UI/UX Design', 'IT Consultancy', 'Graphic Design', 'SEO & Online Marketing', 'Digital Transformation', 'Custom Software'].map(s => (
                <span key={s} className="px-4 py-2 rounded-full text-xs font-medium bg-white shadow-sm border border-blue-100" style={{ color: '#1B3A6E' }}>{s}</span>
              ))}
            </div>
            <div className="text-center mt-6">
              <a href="https://www.innovegicit.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
                style={{ color: '#2563EB' }}>
                Visit innovegicit.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6" style={{ background: 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your HR Operations?</h2>
          <p className="text-white/70 mb-8 leading-relaxed">
            Join businesses across the GCC who trust HumanVerse360 to manage their most important asset — their people.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register"
              className="px-8 py-3.5 rounded-xl font-semibold text-sm bg-white transition-all hover:bg-gray-50"
              style={{ color: '#1B3A6E' }}>
              Get Started Free
            </Link>
            <Link to="/login"
              className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all border border-white/30 text-white hover:bg-white/10">
              Sign In to Your Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-gray-900 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img src="/image.png" alt="HumanVerse360" className="w-7 h-7 object-contain opacity-80" />
            <span className="font-black text-base">
              <span className="text-white">Human</span>
              <span style={{ color: '#7DC8FF' }}>Verse</span>
              <span style={{ color: '#6EE7A0' }}>360</span>
              <span className="text-sm font-bold" style={{ color: '#7DC8FF' }}>.com</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            A product of{' '}
            <a href="https://www.innovegicit.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-200 transition-colors">
              Innovegic Consultancy &amp; IT Services Co W.L.L
            </a>
          </p>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} HumanVerse360. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
