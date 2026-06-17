import { Link } from 'react-router-dom';
import {
  Users, FileText, Calendar, DollarSign, Shield, Globe, CheckCircle,
  ArrowRight, Mail, Phone, ExternalLink, Award, Lightbulb, Zap, Lock,
  MapPin, MessageCircle, Star, Check,
} from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Employee Management', description: 'Comprehensive employee records with custom fields, documents, education history, and dependents — all in one place.' },
  { icon: DollarSign, title: 'Payroll Processing', description: 'Automated monthly payroll runs with detailed salary slips, allowances, deductions, and full breakdown by employee.' },
  { icon: Calendar, title: 'Leave Management', description: 'Multi-type leave configuration, online requests, manager approvals, and real-time balance tracking.' },
  { icon: FileText, title: 'Document & Expiry Alerts', description: 'Proactive alerts for expiring National ID, passport, visa, and work permit documents with escalation notifications.' },
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

const PLANS = [
  {
    code: 'free',
    name: 'Free',
    price: 0,
    maxEmployees: 10,
    popular: false,
    dark: false,
    features: [
      'Up to 10 employees',
      'Employee profiles & records',
      'Document expiry tracking',
      'Passport, Visa, National ID alerts',
      'Email support',
    ],
  },
  {
    code: 'small',
    name: 'Small Enterprise',
    price: 20,
    maxEmployees: 25,
    popular: false,
    dark: false,
    features: [
      'Up to 25 employees',
      'All Free features',
      'Leave management (BH Labour Law)',
      'Monthly payroll processing',
      'Salary slip generation',
      'Indemnity calculator',
      'Employee Self Service (ESS)',
      'Calculation settings & formula engine',
      'Priority support',
    ],
  },
  {
    code: 'medium',
    name: 'Medium Enterprise',
    price: 50,
    maxEmployees: 100,
    popular: true,
    dark: false,
    features: [
      'Up to 100 employees',
      'All Small Enterprise features',
      'Advanced payroll reporting',
      'Multi-department management',
      'Bulk employee imports',
      'Custom integrations',
      'Dedicated account manager',
      'Phone & email support',
    ],
  },
  {
    code: 'large',
    name: 'Large Enterprise',
    price: 250,
    maxEmployees: null,
    popular: false,
    dark: true,
    features: [
      'Unlimited employees',
      'All Medium Enterprise features',
      'Custom integrations',
      'SLA guaranteed uptime',
      'Dedicated implementation team',
      '24/7 priority support',
      'Custom reporting',
      'On-premise deployment option',
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/image_copy_copy.png" alt="HumanVerse360" className="w-9 h-9 object-contain" />
            <span className="text-lg font-black">
              <span style={{ color: '#1B3A6E' }}>Human</span>
              <span style={{ color: '#2563EB' }}>Verse</span>
              <span style={{ color: '#3DB83F' }}>360</span>
              <span className="text-sm font-bold" style={{ color: '#2563EB' }}>.com</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-gray-900 transition-colors">About</a>
            <a href="#contact" className="hover:text-gray-900 transition-colors">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/register"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all">
              Register
            </Link>
            <Link to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)' }}>
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6" style={{ background: 'linear-gradient(160deg, #0D2554 0%, #1B3A6E 55%, #0D3B20 100%)' }}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: '#3DB83F', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: '#2563EB', transform: 'translate(-30%, 30%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <img src="/image_copy_copy.png" alt="HumanVerse360" className="w-24 h-24 object-contain drop-shadow-2xl" />
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
              Register Your Company Free
            </Link>
            <a href="#pricing"
              className="px-7 py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' }}>
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#EFF6FF', color: '#2563EB' }}>Platform Features</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Everything Your HR Team Needs</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              HumanVerse360 is the latest product from Innovegic Consultancy &amp; IT Services —
              an all-in-one cloud platform that eliminates HR complexity for businesses across the GCC.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="group p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: '#EFF6FF' }}>
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
                From GOSI and GPSSA compliance to indemnity calculations under local labour laws,
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

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#EFF6FF', color: '#2563EB' }}>Simple Pricing</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Plans for Every Business Size</h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              Start free and scale as you grow. All plans include core HR features with no hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map(plan => (
              <div key={plan.code}
                className={`relative rounded-2xl overflow-hidden border transition-all hover:shadow-xl ${plan.dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200 hover:border-blue-200'}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 flex items-center gap-1 px-3 py-1.5 rounded-bl-xl text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1B3A6E)' }}>
                    <Star className="w-3 h-3" fill="currentColor" /> Popular
                  </div>
                )}
                <div className={`p-5 border-b ${plan.dark ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
                  <p className={`font-bold text-base mb-2 ${plan.dark ? 'text-white' : 'text-gray-900'}`}>{plan.name}</p>
                  {plan.price === 0 ? (
                    <p className={`text-3xl font-black ${plan.dark ? 'text-white' : 'text-gray-900'}`}>Free</p>
                  ) : (
                    <div>
                      <p className={`text-3xl font-black ${plan.dark ? 'text-white' : 'text-gray-900'}`}>
                        BHD {plan.price}
                        <span className={`text-sm font-normal ${plan.dark ? 'text-gray-400' : 'text-gray-400'}`}>/mo</span>
                      </p>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${plan.dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.maxEmployees ? `Up to ${plan.maxEmployees} employees` : 'Unlimited employees'}
                  </p>
                </div>
                <div className="p-5">
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className={`flex items-start gap-2 text-xs ${plan.dark ? 'text-gray-300' : 'text-gray-600'}`}>
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${plan.dark ? 'text-green-400' : 'text-green-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register"
                    className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      plan.dark
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : plan.popular
                        ? 'text-white hover:opacity-90'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    style={plan.popular && !plan.dark ? { background: 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)' } : {}}>
                    {plan.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            All prices are in Bahraini Dinar (BHD) and billed monthly. Contact us for annual pricing and custom enterprise packages.
          </p>
        </div>
      </section>

      {/* About Innovegic */}
      <section id="about" className="py-20 px-6" style={{ background: '#F8FAFC' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#FEF9C3', color: '#854D0E' }}>The Company Behind It</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Innovegic Consultancy &amp; IT Services Co W.L.L</h2>
            <p className="text-gray-500 max-w-2xl mx-auto leading-relaxed">
              HumanVerse360 is the flagship product of Innovegic — a technology company
              founded on a passion for building intelligent software that drives real business outcomes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-14">
            <div className="space-y-5">
              <div className="p-6 rounded-2xl border border-gray-100 bg-white">
                <h3 className="font-semibold text-lg mb-3" style={{ color: '#1B3A6E' }}>Who We Are</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  At Innovegic, we specialize in delivering cutting-edge software solutions and strategic
                  IT consultancy that drive business success. We help organizations streamline operations,
                  enhance efficiency, and scale confidently in the digital age.
                </p>
              </div>
              <div className="p-6 rounded-2xl border border-gray-100 bg-white">
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
                  <div key={v.title} className="p-4 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow">
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

          <div className="rounded-2xl p-8" style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #F0FDF4 100%)', border: '1px solid #E0EEFF' }}>
            <h3 className="font-semibold text-lg mb-5 text-center" style={{ color: '#1B3A6E' }}>What Innovegic Offers</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {['Web Design', 'Software Development', 'UI/UX Design', 'IT Consultancy', 'Graphic Design', 'Video Editing', 'SEO & Online Marketing', 'Digital Transformation', 'Custom Software'].map(s => (
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

      {/* Contact Us */}
      <section id="contact" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: '#F0FDF4', color: '#3DB83F' }}>Get In Touch</span>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#1B3A6E' }}>Contact Us</h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              Have a question about HumanVerse360 or want to discuss a custom enterprise solution?
              Our team is ready to help.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Mail,
                title: 'Email Us',
                lines: ['info@innovegicit.com', 'support@humanverse360.com'],
                color: '#2563EB',
                bg: '#EFF6FF',
              },
              {
                icon: Phone,
                title: 'Call Us',
                lines: ['+973 38991983', 'Sun – Thu, 9 AM – 6 PM (AST)'],
                color: '#3DB83F',
                bg: '#F0FDF4',
              },
              {
                icon: MapPin,
                title: 'Our Location',
                lines: ['Manama, Kingdom of Bahrain', 'Innovegic Consultancy & IT Services Co W.L.L'],
                color: '#D97706',
                bg: '#FFFBEB',
              },
            ].map(c => (
              <div key={c.title} className="p-6 rounded-2xl border border-gray-100 text-center hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: c.bg }}>
                  <c.icon className="w-5 h-5" style={{ color: c.color }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: '#1B3A6E' }}>{c.title}</h3>
                {c.lines.map((l, i) => (
                  <p key={i} className={`text-sm ${i === 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{l}</p>
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, #0D2554 0%, #1B3A6E 100%)' }}>
            <MessageCircle className="w-8 h-8 text-blue-300 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-2">Ready to get started?</h3>
            <p className="text-blue-200 text-sm mb-6 max-w-md mx-auto">
              Register your company today — free forever for up to 10 employees. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register"
                className="px-7 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3DB83F 0%, #22c55e 100%)', color: '#fff' }}>
                Register Free
              </Link>
              <a href="https://www.innovegicit.com" target="_blank" rel="noopener noreferrer"
                className="px-7 py-3 rounded-xl font-semibold text-sm transition-all border text-white hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                Visit Innovegic
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-gray-900 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img src="/image_copy_copy.png" alt="HumanVerse360" className="w-7 h-7 object-contain opacity-80" />
            <span className="font-black text-base">
              <span className="text-white">Human</span>
              <span style={{ color: '#7DC8FF' }}>Verse</span>
              <span style={{ color: '#6EE7A0' }}>360</span>
              <span className="text-sm font-bold" style={{ color: '#7DC8FF' }}>.com</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            {['#features', '#pricing', '#about', '#contact'].map((href, i) => (
              <a key={href} href={href} className="text-xs text-gray-500 hover:text-gray-300 transition-colors capitalize">
                {['Features', 'Pricing', 'About', 'Contact'][i]}
              </a>
            ))}
            <Link to="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Sign In</Link>
            <Link to="/register" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Register</Link>
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
