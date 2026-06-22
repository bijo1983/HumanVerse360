import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/about" className="flex items-center gap-2.5">
            <img src="/image.png" alt="HumanVerse360" className="w-8 h-8 object-contain" />
            <span className="text-lg font-black">
              <span style={{ color: '#1B3A6E' }}>Human</span>
              <span style={{ color: '#2563EB' }}>Verse</span>
              <span style={{ color: '#3DB83F' }}>360</span>
              <span className="text-sm font-bold" style={{ color: '#2563EB' }}>.com</span>
            </span>
          </Link>
          <Link to="/about"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="py-16 px-6 text-center" style={{ background: 'linear-gradient(160deg, #0D2554 0%, #1B3A6E 100%)' }}>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Legal
        </p>
        <h1 className="text-3xl font-black text-white mb-3">{title}</h1>
        {subtitle && <p className="text-sm max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>{subtitle}</p>}
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-14">
        <div className="prose prose-sm max-w-none legal-content">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-center mt-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img src="/image.png" alt="HumanVerse360" className="w-6 h-6 object-contain opacity-80" />
            <span className="font-black text-sm">
              <span className="text-white">Human</span>
              <span style={{ color: '#7DC8FF' }}>Verse</span>
              <span style={{ color: '#6EE7A0' }}>360</span>
              <span className="text-xs font-bold" style={{ color: '#7DC8FF' }}>.com</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link to="/about" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Home</Link>
            <Link to="/privacy-policy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms &amp; Conditions</Link>
            <Link to="/refund-policy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Refund Policy</Link>
            <Link to="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Sign In</Link>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} HumanVerse360 — Innovegic Consultancy &amp; IT Services Co W.L.L. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
