'use client';

import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/src/i18n';
import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Problem from '@/components/landing/Problem';
import Solution from '@/components/landing/Solution';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Testimonials from '@/components/landing/Testimonials';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Dashboard component for authenticated users
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { MessagesChart, UsersChart } from '@/components/Charts';
import { Users, MessageSquare, Activity, TrendingUp } from 'lucide-react';
import { useState } from 'react';

function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    activeToday: 0,
    messagesToday: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };

    fetchData();
  }, []);

  const chartData = [
    { date: 'Lun', messages: 120, users: 45 },
    { date: 'Mar', messages: 180, users: 52 },
    { date: 'Mié', messages: 150, users: 48 },
    { date: 'Jue', messages: 220, users: 61 },
    { date: 'Vie', messages: 280, users: 73 },
    { date: 'Sáb', messages: 190, users: 55 },
    { date: 'Dom', messages: 160, users: 42 },
  ];

  return (
    <div className="min-h-screen p-6">
      <Header title="Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard title="Usuarios Totales" value={stats.totalUsers} change="+12% este mes" changeType="positive" icon={Users} />
        <StatCard title="Mensajes Totales" value={stats.totalMessages} change="+8% este mes" changeType="positive" icon={MessageSquare} />
        <StatCard title="Activos Hoy" value={stats.activeToday} change="+5 desde ayer" changeType="positive" icon={Activity} />
        <StatCard title="Mensajes Hoy" value={stats.messagesToday} change="+23% esta semana" changeType="positive" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessagesChart data={chartData} />
        <UsersChart data={chartData} />
      </div>

      <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a href="/payments" className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
            <span className="text-2xl">💰</span>
            <div>
              <p className="text-white font-medium">Pagos</p>
              <p className="text-zinc-500 text-sm">Verificar pagos SINPE</p>
            </div>
          </a>
          <a href="/media" className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
            <span className="text-2xl">📷</span>
            <div>
              <p className="text-white font-medium">Subir Media</p>
              <p className="text-zinc-500 text-sm">Agrega imágenes con keywords</p>
            </div>
          </a>
          <a href="/settings" className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="text-white font-medium">Configurar Bot</p>
              <p className="text-zinc-500 text-sm">Personaliza personalidad</p>
            </div>
          </a>
          <a href="/conversations" className="flex items-center gap-3 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
            <span className="text-2xl">💬</span>
            <div>
              <p className="text-white font-medium">Ver Conversaciones</p>
              <p className="text-zinc-500 text-sm">Historial de chats</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

const API_URL = 'http://localhost:3000';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="bg-zinc-950 text-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If user is authenticated, show dashboard
  if (user) {
    return <Dashboard />;
  }

  // If user is not authenticated, show landing page
  return (
    <main className="bg-zinc-950 text-white min-h-screen">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}