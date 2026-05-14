import React from 'react';
import { CareersForm } from '@/components/CareersForm';
import { Briefcase, Users, Zap, Code, Globe, Award, ChevronDown } from 'lucide-react';

const CareersPage = () => {
  const positions = [
    { title: 'Frontend Engineer', icon: Code, count: 3 },
    { title: 'Backend Engineer', icon: Code, count: 2 },
    { title: 'Full Stack Engineer', icon: Code, count: 2 },
    { title: 'Product Manager', icon: Briefcase, count: 1 },
    { title: 'UX Designer', icon: Zap, count: 2 },
    { title: 'Data Scientist', icon: Zap, count: 1 },
  ];

  const benefits = [
    { icon: Award, title: 'Competitive Salary', description: 'Compensation that actually keeps up with the market — plus equity.' },
    { icon: Globe, title: 'Remote-first', description: 'Work wherever you do your best thinking. We mean it.' },
    {
      icon: Users, title: 'Great teammates', description: "A team that ships fast, gives honest feedback, and has each other's back." },
    { icon: Zap, title: 'Room to grow', description: 'Learning budget, senior mentorship, and space to own things.' },
    { icon: Code, title: 'Modern stack', description: 'React, TypeScript, Supabase, Python. No legacy surprises.' },
    { icon: Award, title: 'Solid benefits', description: 'Health, dental, retirement — and actually good parental leave.' },
  ];

  const faqs = [
    {
      question: 'How long does the process take?',
      answer: "Usually 2-4 weeks from application to offer. We move quickly for people we're excited about, and we'll never ghost you."
    },
    {
      question: "What's your tech stack?",
      answer: "React, TypeScript, Node.js, Python, PostgreSQL (Supabase), Tailwind, and AWS. We're opinionated but not dogmatic — good ideas win."
    },
    {
      question: 'Is remote work actually available?',
      answer: "Yes, genuinely. Most of our team is distributed across time zones. We have async-first processes and trust people to manage their own time."
    },
    {
      question: 'What happens after I apply?',
      answer: "We read every application. If it looks like a good fit, expect a short intro call - no trick questions, just a conversation."
    },
    {
      question: 'Do you offer internships?',
      answer: "Yes! We love working with early-career folks. Check for internship listings - we run cohorts a couple of times a year."
    },
    {
      question: 'Can I apply for multiple roles?',
      answer: "Absolutely - just flag it in your application so we can route you to the right people."
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/hirespark-logo.png" alt="HireSpark" className="h-8 w-auto object-contain" />
            <span className="text-xl font-bold text-slate-900 tracking-tight">HireSpark</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="/" className="text-gray-500 hover:text-gray-900 transition-colors duration-150">Dashboard</a>
            <a href="/careers" className="text-slate-900 font-semibold">Careers</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="text-white py-20"
        style={{
          background: 'linear-gradient(135deg, hsl(237 60% 38%) 0%, hsl(237 55% 44%) 45%, hsl(270 55% 50%) 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold mb-5 tracking-tight">Come build with us</h1>
          <p className="text-lg text-indigo-100 max-w-2xl mx-auto leading-relaxed">
            We're growing fast and looking for people who care about craft.
            If that sounds like you, we'd genuinely love to meet you.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24">

        {/* Benefits */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Why HireSpark?</h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">We care about the work and the people doing it. Here's what that looks like in practice.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={idx}
                  className="group bg-white p-8 rounded-xl border border-gray-100 hover:border-slate-200 hover:shadow-md transition-all duration-200"
                >
                  <Icon className="h-9 w-9 text-teal-500 mb-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  <h3 className="text-base font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Open Positions */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Open right now</h2>
          <p className="text-center text-gray-500 mb-12">These are live — apply and you'll hear from us within 48 hours.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map((pos, idx) => {
              const Icon = pos.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 cursor-pointer"
                >
                  <div className="p-2.5 bg-slate-100 rounded-lg">
                    <Icon className="h-5 w-5 text-slate-900 flex-shrink-0" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{pos.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {pos.count === 1 ? '1 spot open' : `${pos.count} open right now`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-teal-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    {pos.count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Application Form */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Ready? Tell us about yourself.</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Drop your details below — we read every application and reply within 2 business days.
          </p>
          <CareersForm />
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Things people usually ask</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((faq, idx) => (
              <details
                key={idx}
                className="group p-6 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all duration-150"
              >
                <summary className="flex items-center justify-between font-semibold text-gray-900 select-none list-none">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 ml-3 group-open:rotate-180 transition-transform duration-200" />
                </summary>
                <p className="mt-4 text-sm text-gray-500 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-12 text-center border border-slate-200">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Not seeing the right fit?</h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
            We hire for attitude and aptitude. Send us your resume — we might surprise you.
          </p>
          <a
            href="#"
            className="inline-block px-8 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-md transition-all duration-150"
          >
            Reach out →
          </a>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-400 mt-24 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-3">HireSpark</h3>
              <p className="text-sm leading-relaxed">Helping teams hire people they'll actually enjoy working with.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/" className="hover:text-white transition-colors duration-150">Dashboard</a></li>
                <li><a href="/" className="hover:text-white transition-colors duration-150">Assessments</a></li>
                <li><a href="/" className="hover:text-white transition-colors duration-150">Interviews</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/careers" className="hover:text-white transition-colors duration-150">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors duration-150">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors duration-150">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <p className="text-xs text-center text-gray-600">© 2026 HireSpark. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CareersPage;
