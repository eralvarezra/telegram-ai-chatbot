'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import { User, Shield, CreditCard, ChevronRight } from 'lucide-react';
import ProfileForm from '@/components/settings/ProfileForm';
import SecurityPanel from '@/components/settings/SecurityPanel';
import BillingPanel from '@/components/settings/BillingPanel';

const API_URL = 'http://localhost:3000';

const menuItems = [
  {
    id: 'profile',
    label: 'Perfil',
    labelEn: 'Profile',
    icon: User,
    description: 'Información personal y foto de perfil'
  },
  {
    id: 'security',
    label: 'Seguridad',
    labelEn: 'Security',
    icon: Shield,
    description: 'Contraseña y autenticación de dos factores'
  },
  {
    id: 'billing',
    label: 'Facturación',
    labelEn: 'Billing',
    icon: CreditCard,
    description: 'Planes, pagos e historial de facturas'
  }
];

export default function AccountSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState('profile');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get tab from URL query parameter
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'security', 'billing'].includes(tab)) {
      setActiveSection(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${API_URL}/api/account/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.profile);
      } else if (res.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    router.push(`/settings/account?tab=${section}`, undefined, { shallow: true });
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileForm user={user} onUpdate={fetchUser} />;
      case 'security':
        return <SecurityPanel user={user} />;
      case 'billing':
        return <BillingPanel user={user} />;
      default:
        return <ProfileForm user={user} onUpdate={fetchUser} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Configuración de Cuenta</h1>
          <p className="text-zinc-400 mt-1">Administra tu perfil, seguridad y facturación</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    } ${index > 0 ? 'border-t border-zinc-800' : ''}`}
                  >
                    <Icon size={20} />
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                    {isActive && <ChevronRight size={16} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}