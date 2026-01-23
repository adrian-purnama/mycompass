'use client';

import { useState, useEffect, useRef } from 'react';
import { FiDatabase, FiCode, FiHardDrive, FiShield, FiUsers, FiClock, FiZap, FiCheck, FiArrowRight } from 'react-icons/fi';
import AuthModal from './AuthModal';
import { useAuth } from '@/hooks/useAuth';

// Hook for scroll-triggered animations
function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return [ref, isVisible];
}

// Hook for 3D mouse tracking
function use3DMouse(ref) {
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      setTransform({ rotateX, rotateY });
    };

    const handleMouseLeave = () => {
      setTransform({ rotateX: 0, rotateY: 0 });
    };

    const element = ref.current;
    if (element) {
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (element) {
        element.removeEventListener('mousemove', handleMouseMove);
        element.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [ref]);

  return transform;
}

// Feature Card Component with 3D
function FeatureCard({ feature, index }) {
  const cardRef = useRef(null);
  const card3D = use3DMouse(cardRef);
  const [cardVisible, setCardVisible] = useState(false);
  const Icon = feature.icon;
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setCardVisible(true), index * 100);
        }
      },
      { threshold: 0.2 }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [index]);
  
  return (
    <div
      ref={cardRef}
      className="group relative p-6 rounded-xl border border-border bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-2xl"
      style={{
        transform: `perspective(1000px) rotateX(${card3D.rotateX}deg) rotateY(${card3D.rotateY}deg) translateZ(${cardVisible ? 0 : -50}px)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.1s ease-out, opacity 0.5s ease-out',
        opacity: cardVisible ? 1 : 0,
        animation: cardVisible ? 'fadeInUp 0.6s ease-out' : 'none'
      }}
    >
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${feature.color.split(' ')[1]}20, ${feature.color.split(' ')[3]}20)`,
          transform: 'translateZ(-10px)'
        }}
      />
      <div 
        className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.color} mb-4 relative z-10 transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
        style={{
          transform: `translateZ(20px) ${card3D.rotateY > 0 ? 'rotateY(5deg)' : 'rotateY(-5deg)'}`
        }}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 
        className="text-xl font-semibold text-foreground mb-2 relative z-10"
        style={{ transform: 'translateZ(10px)' }}
      >
        {feature.title}
      </h3>
      <p 
        className="text-muted-foreground relative z-10"
        style={{ transform: 'translateZ(5px)' }}
      >
        {feature.description}
      </p>
    </div>
  );
}

// Benefit Item Component
function BenefitItem({ benefit, index, visible }) {
  const [itemVisible, setItemVisible] = useState(false);
  
  useEffect(() => {
    if (visible) {
      setTimeout(() => setItemVisible(true), index * 100);
    }
  }, [visible, index]);
  
  return (
    <li 
      className="flex items-start gap-3 transform transition-all duration-500"
      style={{
        transform: itemVisible ? 'translateX(0) translateZ(0)' : 'translateX(-30px) translateZ(-20px)',
        opacity: itemVisible ? 1 : 0
      }}
    >
      <div 
        className="mt-1 p-1 rounded-full bg-green-500/20 transform transition-transform duration-300 hover:scale-110"
        style={{ transform: 'translateZ(10px)' }}
      >
        <FiCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
      </div>
      <span className="text-lg text-foreground">{benefit}</span>
    </li>
  );
}

export default function LandingPage({ onGetStarted }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { login, register } = useAuth();
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const benefitsRef = useRef(null);
  const ctaRef = useRef(null);
  
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [benefitsVisible, setBenefitsVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  
  // Scroll animations
  useEffect(() => {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -100px 0px' };
    
    const featuresObserver = new IntersectionObserver(([entry]) => {
      setFeaturesVisible(entry.isIntersecting);
    }, observerOptions);
    
    const benefitsObserver = new IntersectionObserver(([entry]) => {
      setBenefitsVisible(entry.isIntersecting);
    }, observerOptions);
    
    const ctaObserver = new IntersectionObserver(([entry]) => {
      setCtaVisible(entry.isIntersecting);
    }, observerOptions);

    if (featuresRef.current) featuresObserver.observe(featuresRef.current);
    if (benefitsRef.current) benefitsObserver.observe(benefitsRef.current);
    if (ctaRef.current) ctaObserver.observe(ctaRef.current);

    return () => {
      if (featuresRef.current) featuresObserver.unobserve(featuresRef.current);
      if (benefitsRef.current) benefitsObserver.unobserve(benefitsRef.current);
      if (ctaRef.current) ctaObserver.unobserve(ctaRef.current);
    };
  }, []);

  // Hero stays still - no parallax

  const features = [
    {
      icon: FiDatabase,
      title: 'Database Management',
      description: 'Browse, explore, and manage your MongoDB databases with an intuitive interface.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: FiCode,
      title: 'SQL & Query Editor',
      description: 'Query MongoDB using SQL syntax or native MongoDB queries with syntax highlighting.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: FiHardDrive,
      title: 'Automated Backups',
      description: 'Schedule automatic backups to Google Drive with retention policies and notifications.',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: FiShield,
      title: 'Secure & Encrypted',
      description: 'All connection strings are encrypted. Team collaboration with role-based access control.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: FiUsers,
      title: 'Team Collaboration',
      description: 'Organizations, team members, and shared connections for seamless collaboration.',
      color: 'from-indigo-500 to-blue-500'
    },
    {
      icon: FiClock,
      title: 'Scheduled Backups',
      description: 'Set up automated backup schedules with custom retention policies and notifications.',
      color: 'from-teal-500 to-cyan-500'
    }
  ];

  const benefits = [
    'No installation required - works in your browser',
    'Encrypted connection string storage',
    'Export and clone databases easily',
    'Real-time backup progress tracking',
    'Telegram notifications for backups',
    'Role-based access control'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <FiDatabase className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-foreground">My Compass</span>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Minimal & Still */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
        <div 
          ref={heroRef}
          className="text-center"
        >
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <FiDatabase className="w-12 h-12 text-primary" />
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-foreground">
                MyCompass
              </h1>
            </div>
          </div>
          
          <p className="text-2xl md:text-3xl text-muted-foreground mb-4 max-w-2xl mx-auto font-light">
            MongoDB Management Made Simple
          </p>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            A powerful alternative to MongoDB Compass with SQL querying, automated backups, 
            and team collaboration features.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => setShowAuthModal(true)}
              className="group px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
            >
              Get Started Free
              <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => {
                const featuresSection = document.getElementById('features');
                featuresSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-4 border-2 border-border rounded-lg font-semibold text-lg hover:bg-muted transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid with 3D Cards */}
      <section 
        id="features" 
        ref={featuresRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        style={{ perspective: '1000px' }}
      >
        <div 
          className="text-center mb-16 transform transition-all duration-700"
          style={{
            transform: featuresVisible ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.95)',
            opacity: featuresVisible ? 1 : 0
          }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features to manage, query, and backup your MongoDB databases
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </section>

      {/* Benefits Section with 3D */}
      <section 
        ref={benefitsRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        style={{ perspective: '1200px' }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div
            className="transform transition-all duration-700"
            style={{
              transform: benefitsVisible ? 'translateX(0) rotateY(0deg)' : 'translateX(-100px) rotateY(-10deg)',
              opacity: benefitsVisible ? 1 : 0,
              transformStyle: 'preserve-3d'
            }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Why Choose My Compass?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Built for developers and teams who need a reliable, secure, and feature-rich 
              MongoDB management solution.
            </p>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <BenefitItem key={index} benefit={benefit} index={index} visible={benefitsVisible} />
              ))}
            </ul>
          </div>
          <div 
            className="relative transform transition-all duration-700"
            style={{
              transform: benefitsVisible ? 'translateX(0) rotateY(0deg) translateZ(0)' : 'translateX(100px) rotateY(10deg) translateZ(-50px)',
              opacity: benefitsVisible ? 1 : 0,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl transform" style={{ transform: 'translateZ(-100px)' }}></div>
            <div 
              className="relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm transform transition-transform duration-300 hover:scale-105"
              style={{ 
                transform: 'perspective(1000px) rotateX(2deg) rotateY(-2deg)',
                transformStyle: 'preserve-3d',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div className="space-y-4">
                {[
                  { icon: FiDatabase, title: 'Database Explorer', desc: 'Browse collections and documents' },
                  { icon: FiCode, title: 'Query Editor', desc: 'SQL and MongoDB queries' },
                  { icon: FiHardDrive, title: 'Automated Backups', desc: 'Google Drive integration' }
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 transform transition-all duration-300 hover:translateX(10px) hover:translateZ(10px)"
                    style={{
                      transform: 'translateZ(0)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <item.icon className="w-6 h-6 text-primary" style={{ transform: 'translateZ(5px)' }} />
                    <div style={{ transform: 'translateZ(5px)' }}>
                      <div className="font-semibold text-foreground">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section with 3D */}
      <section 
        ref={ctaRef}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        style={{ perspective: '1000px' }}
      >
        <div 
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 text-center transform transition-all duration-700"
          style={{
            transform: ctaVisible 
              ? 'perspective(1000px) rotateX(0deg) translateY(0) scale(1)' 
              : 'perspective(1000px) rotateX(10deg) translateY(100px) scale(0.9)',
            opacity: ctaVisible ? 1 : 0,
            transformStyle: 'preserve-3d'
          }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-5" style={{ transform: 'translateZ(-50px)' }}></div>
          <div 
            className="relative z-10"
            style={{ transform: 'translateZ(20px)' }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join developers and teams who trust My Compass for their MongoDB management needs.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="group px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:opacity-90 transition-all flex items-center gap-2 mx-auto shadow-lg transform hover:scale-110 hover:translateZ(30px)"
              style={{
                transform: 'perspective(1000px) translateZ(0)',
                transition: 'all 0.3s ease',
                transformStyle: 'preserve-3d'
              }}
            >
              Create Free Account
              <FiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <FiDatabase className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">My Compass</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} My Compass. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={login}
          onRegister={register}
        />
      )}
    </div>
  );
}
