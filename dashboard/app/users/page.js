'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { MessageCircle, Clock, TrendingUp, User } from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('activity'); // 'activity' | 'recent' | 'messages'

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/users`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Could not connect to backend. Make sure server is running on port 3000.');
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (sortBy === 'activity' || sortBy === 'messages') {
      return (b.message_count || 0) - (a.message_count || 0);
    }
    if (sortBy === 'recent') {
      return new Date(b.last_seen) - new Date(a.last_seen);
    }
    return 0;
  });

  const truncateMessage = (msg, maxLength = 60) => {
    if (!msg) return 'No messages yet';
    if (msg.length <= maxLength) return msg;
    return msg.substring(0, maxLength) + '...';
  };

  return (
    <div className="min-h-screen">
      <Header title="Chats" />

      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Conversaciones</h2>
            <p className="text-zinc-400 mt-1">Chats con más actividad</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">Ordenar por:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSortBy('activity')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'activity'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <TrendingUp size={14} className="inline mr-1" />
                Actividad
              </button>
              <button
                onClick={() => setSortBy('recent')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <Clock size={14} className="inline mr-1" />
                Recientes
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-900/50 rounded-lg">
                <User className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Usuarios</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-900/50 rounded-lg">
                <MessageCircle className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Mensajes</p>
                <p className="text-2xl font-bold text-white">
                  {users.reduce((sum, u) => sum + (u.message_count || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-900/50 rounded-lg">
                <TrendingUp className="text-purple-400" size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Activos Hoy</p>
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => {
                    const lastSeen = new Date(u.last_seen);
                    const today = new Date();
                    return lastSeen.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <MessageCircle size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">No hay conversaciones aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => router.push(`/users/${user.id}`)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium truncate">
                        {user.display_name || user.username || 'Unknown'}
                      </h3>
                      {user.last_tone && (
                        <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded-full">
                          {user.last_tone}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-500 text-sm truncate">
                      {user.last_message_role === 'user' ? '👤 ' : '🤖 '}
                      {truncateMessage(user.last_message)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <MessageCircle size={12} />
                      <span>{user.message_count || 0}</span>
                    </div>
                    <span className="text-zinc-500 text-xs">
                      {formatRelativeTime(user.last_seen)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}