'use client';

import { useState, useEffect } from 'react';
import { Lock, Shield, Smartphone, Monitor, Trash2, AlertTriangle, Check, Eye, EyeOff, LogOut, Key } from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function SecurityPanel({ user }) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  useEffect(() => {
    fetchSessions();
    setTwoFactorEnabled(user?.two_factor_enabled || false);
  }, [user]);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        // Assume first session is current
        if (data.sessions?.length > 0) {
          setCurrentSessionId(data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'La contraseña debe tener al menos 8 caracteres' });
      return;
    }

    setSavingPassword(true);
    setPasswordMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Error al cambiar contraseña' });
      }
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = twoFactorEnabled ? '/api/account/2fa/disable' : '/api/account/2fa/enable';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setTwoFactorEnabled(!twoFactorEnabled);
      }
    } catch (error) {
      console.error('Error toggling 2FA:', error);
    }
  };

  const handleInvalidateSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  };

  const handleInvalidateOtherSessions = async () => {
    if (!confirm('¿Estás seguro de cerrar todas las otras sesiones?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/account/sessions/invalidate-others`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchSessions();
      }
    } catch (error) {
      console.error('Error invalidating sessions:', error);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseDeviceInfo = (userAgent) => {
    if (!userAgent) return 'Dispositivo desconocido';

    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('Linux')) return 'Linux';

    return 'Dispositivo desconocido';
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lock size={18} />
          Cambiar Contraseña
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Contraseña Actual</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-10 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pr-10 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Mínimo 8 caracteres</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Confirmar Contraseña</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {/* Message */}
          {passwordMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-xl ${
              passwordMessage.type === 'success'
                ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                : 'bg-red-600/20 text-red-400 border border-red-600/30'
            }`}>
              {passwordMessage.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
              <span className="text-sm">{passwordMessage.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-medium rounded-xl transition-colors"
          >
            {savingPassword ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Key size={16} />
                Actualizar Contraseña
              </>
            )}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={18} />
          Autenticación de Dos Factores
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-300">
              {twoFactorEnabled ? '2FA está activado' : '2FA está desactivado'}
            </p>
            <p className="text-sm text-zinc-500">
              Añade una capa extra de seguridad a tu cuenta
            </p>
          </div>

          <button
            onClick={handleToggle2FA}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              twoFactorEnabled
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30'
                : 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30'
            }`}
          >
            {twoFactorEnabled ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Monitor size={18} />
            Sesiones Activas
          </h2>

          {sessions.length > 1 && (
            <button
              onClick={handleInvalidateOtherSessions}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Cerrar otras sesiones
            </button>
          )}
        </div>

        {loadingSessions ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-zinc-500 text-center py-4">No hay sesiones activas</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  session.id === currentSessionId
                    ? 'bg-blue-600/10 border border-blue-600/30'
                    : 'bg-zinc-800/50 border border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    session.id === currentSessionId ? 'bg-blue-600/20' : 'bg-zinc-700'
                  }`}>
                    <Smartphone size={18} className="text-zinc-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {parseDeviceInfo(session.device_info)}
                      </span>
                      {session.id === currentSessionId && (
                        <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">
                          Sesión actual
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {session.ip_address || 'IP desconocida'} • {formatDate(session.last_active)}
                    </div>
                  </div>
                </div>

                {session.id !== currentSessionId && (
                  <button
                    onClick={() => handleInvalidateSession(session.id)}
                    className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                    title="Cerrar sesión"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {user?.last_login && (
          <p className="text-sm text-zinc-500 mt-4">
            Último inicio de sesión: {formatDate(user.last_login)}
          </p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-red-400 mb-4">Zona de Peligro</h2>
        <p className="text-zinc-400 mb-4">
          Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, asegúrate.
        </p>
        <button
          onClick={() => {
            if (confirm('¿Estás seguro de eliminar tu cuenta? Esta acción no se puede deshacer.')) {
              // Handle account deletion
              alert('Función de eliminación de cuenta próximamente disponible');
            }
          }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors"
        >
          Eliminar Cuenta
        </button>
      </div>
    </div>
  );
}