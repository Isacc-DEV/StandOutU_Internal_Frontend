'use client';
import Link from "next/link";
import TopNav from "../components/TopNav";
import { FileText, Sparkles, LayoutDashboard, Link2, Users, Calendar, Target, Eye, Heart, Mail, MessageCircle, Phone, Linkedin } from "lucide-react";
import { useState, useEffect } from "react";
import { handleError } from "../lib/errorHandler";

const features = [
  {
    icon: FileText,
    title: "Resume Tailoring & Analysis",
    description: "AI-powered resume analysis and customization for each job application, ensuring your resume highlights the most relevant skills and experience.",
    image: "/images/tailor-resume-image.png",
  },
  {
    icon: Sparkles,
    title: "Job Application Autofill",
    description: "Intelligent form autofill that understands job requirements and automatically completes application forms with precision and accuracy.",
    image: "/images/autofill-application_image.png",
  },
  {
    icon: LayoutDashboard,
    title: "Internal Management",
    description: "Keep tasks, reports, schedules, and team messages organized in one place for effective internal operations.",
    image: "/images/hero-background3.png",
  },
  {
    icon: Link2,
    title: "Job Links Tracking",
    description: "Organize and track job opportunities from multiple sources, with intelligent filtering and status management capabilities.",
    image: "/images/joblink-scratch-image.png",
  },
  {
    icon: Users,
    title: "Community Features",
    description: "Connect with other job seekers, share insights, and collaborate on your job search journey through our community platform.",
    image: "/images/community-feature-image.png",
  },
  {
    icon: Calendar,
    title: "Calendar Integration",
    description: "Sync your interview schedules and important dates with your calendar, keeping your job search organized and on track.",
    image: "/images/calendar-integration-image.png",
  },
];

export default function Page() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  
  const backgroundImages = [
    '/images/hero-background1.png',
    '/images/hero-background2.png',
    '/images/hero-background3.png',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  useEffect(() => {
    // Handle hash navigation on page load
    if (window.location.hash === '#about') {
      setTimeout(() => {
        const aboutSection = document.getElementById('about');
        if (aboutSection) {
          aboutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#0b1224] text-[#e9eef7]">
      <TopNav />
      <div className="w-full pt-[57px]">
        {/* Hero Section */}
        <section className="relative overflow-hidden min-h-[600px] bg-[#0b1224]">
          {/* Animated Background Images */}
          <div className="absolute inset-0 z-0 w-full h-full">
            {backgroundImages.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
                  index === currentImageIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
                style={{
                  backgroundImage: `url(${image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            ))}
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-[#0b1224]/70 z-10" />
          </div>
          
          <div className="relative z-30 mx-auto max-w-screen-2xl px-4 py-24 sm:py-32 min-h-[600px] flex items-center justify-center w-full">
            <div className="flex flex-col items-center text-center w-full">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-slate-300">
                  SmartWork Platform
                </span>
                <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl">
                  Work smarter from a single place.
                </h1>
                <p className="mx-auto max-w-2xl text-lg text-slate-300 sm:text-xl">
                  Generate tailored resumes with beautiful templates, auto-fill applications in one click, and manage schedules and messages effortlessly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative border-t border-white/5 bg-[#0f162b] py-24">
          <div className="mx-auto max-w-screen-2xl px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">Powerful Features</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
                Everything you need to streamline your job application process and stand out from the crowd.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="group rounded-2xl border border-white/10 bg-[#111a32] p-6 transition hover:border-[#6366f1]/50 hover:shadow-[0_8px_30px_rgba(99,102,241,0.12)]"
                  >
                    <div className="mb-5 h-64  w-full overflow-hidden rounded-xl border border-white/5 bg-[#0f162b]">
                      <div
                        className="h-full w-full bg-cover bg-center transition duration-500 group-hover:scale-105"
                        style={{ backgroundImage: `url(${feature.image})` }}
                      />
                    </div>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#6366f1]/20 text-[#6366f1] transition group-hover:bg-[#6366f1]/30">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <section id="about" className="relative border-t border-white/5 bg-[#0b1224]">
          {/* Hero Section */}
          <div className="relative overflow-hidden border-b border-white/5">
            {/* Background Image */}
            <div className=" inset-0 z-0 w-full h-auto">
              <img
                src="/images/hero-background4.png"
                alt="Hero background"
                className="inset-0 w-full h-auto object-cover"
                style={{
                  backgroundImage: 'url(/images/hero-background4.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              {/* Overlay for better text readability */}
              <div className="absolute inset-0 bg-[#0b1224]/70 z-10" />
            </div>
            <div className="absolute inset-0 z-30 mx-auto max-w-screen-2xl px-4 py-24 sm:py-32 min-h-[400px] flex items-center justify-center w-full">
              <div className="flex flex-col items-center text-center">
                <div className="space-y-6">
                  <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl md:text-7xl">
                    About Us
                  </h1>
                  <p className="mx-auto max-w-3xl text-lg text-slate-300 sm:text-xl">
                    We're on a mission to revolutionize the job application process, making it easier, smarter, and more effective for everyone.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission & Vision Section */}
          <div className="relative border-b border-white/5 bg-[#0f162b] py-24">
            <div className="mx-auto max-w-screen-2xl px-4">
              <div className="space-y-16">
                {/* Mission Section */}
                <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
                  <div>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6366f1]/20 text-[#6366f1]">
                        <Target className="h-6 w-6" />
                      </div>
                      <h2 className="text-3xl font-bold sm:text-4xl">Our Mission</h2>
                    </div>
                    <div className="space-y-4 text-lg leading-relaxed text-slate-300">
                      <p>
                        Our mission is to empower job seekers with intelligent tools that streamline the application process, 
                        eliminate repetitive tasks, and help them present their best selves to potential employers.
                      </p>
                      <p>
                        We believe that everyone deserves access to sophisticated career tools that were previously available 
                        only to a select few. By leveraging AI and automation, we're leveling the playing field and helping 
                        talented individuals focus on what matters most: finding the right opportunities and showcasing their unique value.
                      </p>
                    </div>
                  </div>
                  <div className="h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111a32] md:h-80">
                    <img
                      src="/images/64fd563f-a16b-4245-bc71-1f68264e6931.png"
                      alt="Our Mission"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>

                {/* Vision Section */}
                <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
                  <div className="h-64 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111a32] md:h-80">
                    <img
                      src="/images/c4ba8a6a-9c59-43ec-aa67-fddeae89febf.png"
                      alt="Our Vision"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5ef3c5]/20 text-[#5ef3c5]">
                        <Eye className="h-6 w-6" />
                      </div>
                      <h2 className="text-3xl font-bold sm:text-4xl">Our Vision</h2>
                    </div>
                    <div className="space-y-4 text-lg leading-relaxed text-slate-300">
                      <p>
                        We envision a future where job searching is seamless, personalized, and stress-free. A world where 
                        technology handles the tedious parts of job applications, allowing candidates to focus on building 
                        meaningful connections and pursuing opportunities that truly align with their goals.
                      </p>
                      <p>
                        Our platform will continue to evolve, incorporating the latest advancements in AI and user experience 
                        design to stay ahead of the curve. We're committed to being the leading platform that transforms how 
                        people find and apply to jobs, making career advancement more accessible and efficient for everyone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="relative border-b border-white/5 bg-[#0f162b] py-24">
            <div className="mx-auto max-w-screen-2xl px-4">
              <div className="mb-16 text-center">
                <h2 className="text-3xl font-bold sm:text-4xl">Our Values</h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
                  The principles that guide everything we do and shape our commitment to our users.
                </p>
              </div>
              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    icon: Target,
                    title: "Innovation",
                    description: "We continuously innovate to provide cutting-edge solutions that help job seekers succeed in their career journeys.",
                  },
                  {
                    icon: Heart,
                    title: "User-Centric",
                    description: "Our users are at the heart of everything we do. We build features and tools that genuinely solve real problems.",
                  },
                  {
                    icon: Eye,
                    title: "Transparency",
                    description: "We believe in clear, honest communication and transparent processes that build trust with our community.",
                  },
                  {
                    icon: Users,
                    title: "Collaboration",
                    description: "We foster a collaborative environment where ideas flourish and everyone can contribute to making job searching better.",
                  },
                ].map((value, index) => {
                  const Icon = value.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-[#111a32] p-8 transition hover:border-white/20"
                    >
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#6366f1]/20 text-[#6366f1]">
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="mb-3 text-2xl font-semibold">{value.title}</h3>
                      <p className="text-slate-400 leading-relaxed">{value.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Team Section */}
          <div className="relative py-24 bg-gradient-to-b from-[#0b1224] via-[#0f162b] to-[#0b1224]">
            <div className="mx-auto max-w-screen-2xl px-4">
              <div className="mb-3 text-center">
                <div className="mb-3 flex items-center justify-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1]/30 to-[#8b5cf6]/30 text-[#6366f1] shadow-lg shadow-[#6366f1]/20">
                    <Users className="h-7 w-7" />
                  </div>
                  <h2 className="text-4xl font-bold sm:text-5xl bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    Our Team
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-visible py-8 pb-12 -mx-4 px-4">
                <div className="flex gap-2 min-w-max justify-center items-start">
                  {[
                    {
                      name: "Sam",
                      role: "Bidding Manager",
                      photo: "images/57d18289-cd19-4cb2-8c95-b84049c7c37d.png",
                    },
                    {
                      name: "Sabeela",
                      role: "HR Manager",
                      photo: "images/d851bc17-16d0-42bf-ae37-af97d077d760.png",
                    },
                    {
                      name: "Amano Jun",
                      role: "Frontend Developer & UI/UX Designer",
                      photo: "/images/8291bc18-10e0-14ef-ad31-ef88b01.png",
                    },
                    {
                      name: "Rohail Aman",
                      role: "CTO & Co-Founder",
                      photo: "/images/8252b997-7e81-406a-aaf5-1bd532ffa20d.png",
                    },
                    {
                      name: "Isacc Wang",
                      role: "CEO & Founder",
                      photo: "/images/aea7df34-be01-48a6-b385-67e0bdc6670a.png",
                    },
                    {
                      name: "James Wang",
                      role: "Lead Engineer & Co-Founder",
                      photo: "/images/1868fb7c-134a-48b2-8853-31e32d2e7052.png",
                    },
                    {
                      name: "Muneer",
                      role: "Account Manager",
                      photo: "images/ddd7aee4-b22c-431b-be31-81d250a0a4ee.png",
                    },
                    {
                      name: "Jolain",
                      role: "Marketing Manager",
                      photo: "images/82abfafa-e512-453b-82d9-ec2ddebf0c3a.png",
                    },
                    {
                      name: "Aftab",
                      role: "Business Developer",
                      photo: "images/a3fe482a-c24c-aa23-b221-77ae290fa9d33.png",
                    }
                  ].map((member, index) => (
                    <div
                      key={index}
                      className="group flex flex-col items-center transition-all duration-300 flex-shrink-0 w-28 pt-4"
                    >
                      <div className="relative mb-4 flex items-center justify-center h-28">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#6366f1]/40 to-[#8b5cf6]/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-150" />
                        <div className="relative h-16 w-16 group-hover:h-28 group-hover:w-28 rounded-full ring-2 group-hover:ring-4 ring-white/10 group-hover:ring-[#6366f1]/50 transition-all duration-300 overflow-hidden">
                          <img
                            src={member.photo}
                            alt={member.name}
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 group-hover:h-28 group-hover:w-28 object-cover rounded-full transition-all duration-300 origin-center"
                          />
                        </div>
                      </div>
                      <h3 className="mb-1 text-base font-bold text-white group-hover:text-[#6366f1] transition-colors duration-300 text-center">
                        {member.name}
                      </h3>
                      <p className="text-center text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors duration-300 leading-tight">
                        {member.role}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Us Section */}
          <div className="relative border-t border-white/5 bg-[#0f162b] py-24">
            <div className="mx-auto max-w-screen-2xl px-4">
              {/* Header */}
              <div className="mb-12 flex items-center justify-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6366f1]/20 text-[#6366f1]">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold sm:text-4xl">Contact Us</h2>
              </div>
              
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 lg:items-stretch">
                {/* Left Column - Text Content */}
                <div className="flex flex-col space-y-8">
                  <div>
                    <h3 className="mb-4 text-xl font-semibold text-slate-200">Get in Touch</h3>
                    <p className="mb-4 text-base leading-relaxed text-slate-300">
                      Have questions, feedback, or want to get in touch? We'd love to hear from you!
                    </p>
                    <p className="text-base leading-relaxed text-slate-400">
                      Whether you're looking for support, have a business inquiry, or just want to say hello, 
                      our team is here to help. Fill out the form and we'll get back to you as soon as possible.
                    </p>
                  </div>
                  
                  <div className="flex-1 space-y-4 rounded-2xl border border-white/10 bg-[#111a32] p-6">
                    <h4 className="mb-4 text-lg font-semibold text-slate-200">Contact Information</h4>
                    <div className="space-y-4">
                      <a
                        href="mailto:support@standoutu.com"
                        className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-[#6366f1]/50 hover:bg-white/10"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/20 text-[#6366f1] transition group-hover:bg-[#6366f1]/30">
                          <Mail className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Email</p>
                          <p className="mt-1 truncate text-sm font-medium text-slate-200 group-hover:text-white">
                            support@standoutu.com
                          </p>
                        </div>
                      </a>
                      <a
                        href="tel:+15551234567"
                        className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-[#6366f1]/50 hover:bg-white/10"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#6366f1]/20 text-[#6366f1] transition group-hover:bg-[#6366f1]/30">
                          <Phone className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Phone</p>
                          <p className="mt-1 text-sm font-medium text-slate-200 group-hover:text-white">
                            +1 (555) 123-4567
                          </p>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Right Column - Form */}
                <div className="flex flex-col">
                  <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setFormStatus('submitting');
                    try {
                      // Simulate form submission - replace with actual API call
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      setFormStatus('success');
                      setFormData({ name: '', email: '', subject: '', message: '' });
                      setTimeout(() => setFormStatus('idle'), 3000);
                    } catch (err) {
                      setFormStatus('idle');
                      handleError(err, 'An error occurred while sending your message. Please contact the administrator.');
                    }
                  }}
                  className="flex-1 space-y-6 rounded-2xl border border-white/10 bg-[#111a32] p-8 shadow-xl"
                >
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-200">
                        Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#6366f1] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-200">
                        Email <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#6366f1] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                        placeholder="your.email@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-slate-200">
                      Subject <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#6366f1] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                      placeholder="What's this about?"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-2 block text-sm font-semibold text-slate-200">
                      Message <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 transition-all focus:border-[#6366f1] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 resize-none"
                      placeholder="Tell us more about your inquiry..."
                    />
                  </div>
                  {formStatus === 'success' && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
                      <div className="flex items-center gap-2">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Thank you! Your message has been sent successfully. We'll get back to you soon.</span>
                      </div>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={formStatus === 'submitting'}
                    className="w-full rounded-lg bg-[#6366f1] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6366f1]/25 transition-all hover:bg-[#5856eb] hover:shadow-xl hover:shadow-[#6366f1]/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#6366f1]"
                  >
                    {formStatus === 'submitting' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
