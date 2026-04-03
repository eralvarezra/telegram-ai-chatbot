'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, User, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { NotificationBell } from '@/components/notifications';

const API_URL = 'http://localhost:3000';

export default function Header({ title }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/account/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.profile);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/login');
  };

  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'A';
  };

  const menuItems = [
    {
      id: 'profile',
      label: 'Mi Perfil',
      icon: User,
      href: '/settings/account'
    },
    {
      id: 'security',
      label: 'Seguridad',
      icon: Settings,
      href: '/settings/account?tab=security'
    },
    {
      id: 'billing',
      label: 'Facturación',
      icon: CreditCard,
      href: '/settings/account?tab=billing'
    }
  ];

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 hover:bg-zinc-800 rounded-lg px-2 py-1 transition-colors"
          >
            {/* Avatar */}
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium overflow-hidden">
              {user?.picture ? (
                <img src={user.picture} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                getInitials()
              )}
            </div>
            <ChevronDown size={16} className={`text-zinc-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* User Info */}
              <div className="p-4 border-b border-zinc-700">
                <p className="text-white font-medium truncate">{user?.name || 'Usuario'}</p>
                <p className="text-zinc-400 text-sm truncate">{user?.email || ''}</p>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setDropdownOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Logout */}
              <div className="border-t border-zinc-700 py-2">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-400 hover:bg-red-600/20 transition-colors"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}