'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Calendar,
  Clock3,
  FileText,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import TopNav from '../components/TopNav';
import { handleError } from '../lib/errorHandler';

const stats = [
  { value: '6', label: 'Core workflows unified' },
  { value: '1', label: 'Clean operational workspace' },
  { value: '24/7', label: 'Always-on team visibility' },
];

const featureGroups = [
  {
    icon: FileText,
    title: 'Resume Tailoring',
    description:
      'Generate role-specific resumes with structured guidance, cleaner templates, and faster revision cycles.',
  },
  {
    icon: Sparkles,
    title: 'Application Autofill',
    description:
      'Reduce repetitive form work with a focused autofill flow built for speed, consistency, and fewer manual errors.',
  },
  {
    icon: LayoutDashboard,
    title: 'Operational Oversight',
    description:
      'Keep reports, tasks, applications, and account activity organized in a single internal workspace.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Job Link Tracking',
    description:
      'Review fresh opportunities, segment by region, and move directly into the application workflow.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description:
      'Coordinate across managers, bidders, and support teams with shared visibility and cleaner communication loops.',
  },
  {
    icon: Calendar,
    title: 'Calendar Coordination',
    description:
      'Track interviews and planning windows with connected mailbox and scheduling workflows.',
  },
];

const workflowSteps = [
  {
    title: 'Prepare',
    description: 'Select the right profile, review job context, and generate the material needed to move quickly.',
  },
  {
    title: 'Execute',
    description: 'Fill applications, manage related tasks, and keep activity aligned without switching between tools.',
  },
  {
    title: 'Review',
    description: 'Follow reports, status signals, and communication threads from one clear internal system.',
  },
];

const valuePillars = [
  {
    icon: Target,
    title: 'Clarity First',
    description: 'Every screen should help the team decide faster and work with less friction.',
  },
  {
    icon: ShieldCheck,
    title: 'Professional by Default',
    description: 'The product should feel dependable, structured, and appropriate for real internal operations.',
  },
  {
    icon: BadgeCheck,
    title: 'Useful Automation',
    description: 'Automation should reduce effort while staying transparent and easy to trust.',
  },
];

const teamMembers = [
  { name: 'Sam', role: 'Bidding Manager' },
  { name: 'Sabeela', role: 'HR Manager' },
  { name: 'Amano Jun', role: 'Frontend Developer and UI/UX Designer' },
  { name: 'Rohail Aman', role: 'CTO and Co-Founder' },
  { name: 'Isacc Wang', role: 'CEO and Founder' },
  { name: 'James Wang', role: 'Lead Engineer and Co-Founder' },
  { name: 'Muneer', role: 'Account Manager' },
  { name: 'Jolain', role: 'Marketing Manager' },
  { name: 'Aftab', role: 'Business Developer' },
];

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .map((part) => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'SU'
  );
}

export default function Page() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (window.location.hash !== '#about') return;
    window.setTimeout(() => {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4f8_45%,#ffffff_100%)] text-slate-900">
      <TopNav />
      <div className="w-full pt-[57px]">
        <section className="relative overflow-hidden border-b border-slate-200/70">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]" />
          <div className="absolute left-10 top-16 h-40 w-40 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="absolute right-10 top-20 h-44 w-44 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="relative mx-auto grid max-w-screen-2xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
            <div className="space-y-8">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-600 shadow-sm">
                  StandOutU Internal
                </span>
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  A cleaner workspace for applications, reporting, and team execution.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                  SmartWork brings resume preparation, autofill, task coordination, reporting, and communication
                  into one professional internal system with a lighter, more focused interface.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#about"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Learn More
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.32)] backdrop-blur"
                  >
                    <div className="text-3xl font-semibold text-slate-950">{item.value}</div>
                    <div className="mt-2 text-sm text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_32px_90px_-54px_rgba(15,23,42,0.4)] backdrop-blur sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Workflow Snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Built for internal teams</h2>
                </div>
                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {[
                  {
                    label: 'Resume and autofill',
                    detail: 'Generate tailored material, then move directly into application execution.',
                  },
                  {
                    label: 'Tasks and reports',
                    detail: 'Track ownership, progress, and daily visibility without context switching.',
                  },
                  {
                    label: 'Mail and calendar',
                    detail: 'Keep communication and scheduling aligned with operational work.',
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700 shadow-sm">
                        0{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-slate-950 px-5 py-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Cleaner UI direction</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Text, iconography, spacing, and structure now lead the experience instead of image-heavy panels.
                    </div>
                  </div>
                  <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-300" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Capabilities</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Everything the team needs, organized with more discipline.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The platform is now positioned around clearer hierarchy, lighter surfaces, and functional components
                that communicate quickly without decorative image clutter.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featureGroups.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-7 shadow-[0_24px_70px_-54px_rgba(15,23,42,0.34)] transition hover:-translate-y-1 hover:border-slate-300"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-slate-950">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="about" className="border-y border-slate-200/70 bg-white/80 py-20 sm:py-24">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
              <div className="rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-8 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.32)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Mission</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Reduce friction for every application workflow.</h2>
                <div className="mt-5 space-y-4 text-base leading-8 text-slate-600">
                  <p>
                    StandOutU exists to help teams move through application work with more consistency, less repetition,
                    and better internal visibility.
                  </p>
                  <p>
                    Instead of depending on scattered tools, the platform brings preparation, action, and follow-up into
                    one place so people can focus on quality decisions and cleaner execution.
                  </p>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-8 text-slate-100 shadow-[0_32px_90px_-54px_rgba(15,23,42,0.48)]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Vision</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">A professional internal platform that feels simple to operate.</h2>
                <div className="mt-5 space-y-4 text-base leading-8 text-slate-300">
                  <p>
                    The goal is a workspace where reporting, communication, scheduling, and task ownership feel connected
                    instead of fragmented.
                  </p>
                  <p>
                    A lighter visual system supports that vision by making information easier to scan, easier to trust,
                    and easier to maintain.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {valuePillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="rounded-[1.75rem] border border-slate-200/80 bg-white p-7 shadow-[0_24px_60px_-52px_rgba(15,23,42,0.28)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-slate-950">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">How It Works</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  A simpler path from intake to follow-up.
                </h2>
                <div className="mt-8 space-y-4">
                  {workflowSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 shadow-[0_24px_70px_-58px_rgba(15,23,42,0.28)]"
                    >
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_32px_90px_-60px_rgba(15,23,42,0.32)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <Clock3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Operational Focus</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-950">What the clean, light direction improves</h3>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    'Better scanability for dense information',
                    'Less visual noise in task-oriented screens',
                    'Stronger hierarchy between actions and content',
                    'More professional presentation for internal use',
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-5 w-5 text-slate-500" />
                    <p className="text-sm leading-7 text-slate-600">
                      The refresh is intentionally image-free across the presentation layer so the interface feels calmer,
                      lighter, and more durable as the product grows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/70 bg-white/80 py-20 sm:py-24">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 flex items-center justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Team</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  People behind the platform
                </h2>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 sm:inline-flex">
                Profile cards, without photo imagery
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {teamMembers.map((member) => (
                <div
                  key={`${member.name}-${member.role}`}
                  className="rounded-[1.5rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_20px_60px_-52px_rgba(15,23,42,0.28)]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {getInitials(member.name)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{member.name}</h3>
                      <p className="text-sm leading-6 text-slate-500">{member.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Contact</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Reach the team with a clear request.
              </h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Questions, support needs, or product feedback can all come through the same channel.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-8 text-white shadow-[0_32px_90px_-54px_rgba(15,23,42,0.48)]">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-semibold">Get in touch</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      Use the contact form for product questions, operational support, or general business inquiries.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <a
                      href="mailto:support@standoutu.com"
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Email</div>
                        <div className="mt-1 text-sm font-medium text-white">support@standoutu.com</div>
                      </div>
                    </a>
                    <a
                      href="tel:+15551234567"
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:bg-white/10"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Phone</div>
                        <div className="mt-1 text-sm font-medium text-white">+1 (555) 123-4567</div>
                      </div>
                    </a>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
                    <div className="text-sm font-semibold text-white">What to expect</div>
                    <p className="mt-2 text-sm leading-7 text-slate-300">
                      Messages are reviewed for support, product feedback, and business coordination. Include enough
                      detail to help the team respond efficiently.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setFormStatus('submitting');
                  try {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    setFormStatus('success');
                    setFormData({ name: '', email: '', subject: '', message: '' });
                    window.setTimeout(() => setFormStatus('idle'), 3000);
                  } catch (err) {
                    setFormStatus('idle');
                    handleError(err, 'An error occurred while sending your message. Please contact the administrator.');
                  }
                }}
                className="rounded-[2rem] border border-slate-200/80 bg-white p-8 shadow-[0_32px_90px_-60px_rgba(15,23,42,0.32)]"
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Name <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:bg-white focus:ring-slate-300"
                      placeholder="Your name"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Email <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:bg-white focus:ring-slate-300"
                      placeholder="your.email@example.com"
                    />
                  </label>
                </div>

                <label className="mt-6 block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Subject <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(event) => setFormData({ ...formData, subject: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:bg-white focus:ring-slate-300"
                    placeholder="What is this about?"
                  />
                </label>

                <label className="mt-6 block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Message <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(event) => setFormData({ ...formData, message: event.target.value })}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition focus:border-slate-300 focus:bg-white focus:ring-slate-300"
                    placeholder="Tell us how we can help."
                  />
                </label>

                {formStatus === 'success' ? (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    Thank you. Your message has been sent successfully.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={formStatus === 'submitting'}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formStatus === 'submitting' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
