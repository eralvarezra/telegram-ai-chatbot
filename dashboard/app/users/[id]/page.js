'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import ChatUI from '@/components/ChatUI';
import { formatDateTime } from '@/lib/utils';
import { getUser, getUserMessages, blockUser, checkIfBlocked } from '@/lib/api';
import { ArrowLeft, User, MessageSquare, Calendar, Ban, Copy } from 'lucide-react';

export default function UserDetailPage({ params }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userData, messagesData] = await Promise.all([
          getUser(params.id),
          getUserMessages(params.id, 50),
        ]);
        setUser(userData);
        setMessages(messagesData);

        // Check if user is blocked
        if (userData?.telegram_id) {
          try {
            const result = await checkIfBlocked(userData.telegram_id.toString());
            setIsBlocked(result.isBlocked);
          } catch (e) {
            console.error('Error checking blocked status:', e);
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        alert('Error al cargar datos del usuario. Verifica que el servidor backend esté corriendo.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  const handleBlockUser = async () => {
    if (blocking || !user?.telegram_id) return;

    setBlocking(true);
    try {
      const displayName = user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || null;
      await blockUser(user.telegram_id.toString(), user.username || null, displayName, 'Blocked from user detail');
      setIsBlocked(true);
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Error al bloquear usuario');
    } finally {
      setBlocking(false);
    }
  };

  const handleCopyTelegramId = () => {
    if (user?.telegram_id) {
      navigator.clipboard.writeText(user.telegram_id.toString());
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={user?.display_name || user?.username || 'User Detail'} />

      <div className="p-6">
        {/* Back button */}
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft size={20} />
          Back to Users
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Info */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                  <User size={32} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {user?.display_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Unknown'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-zinc-400 font-mono text-sm">ID: {user?.telegram_id?.toString()}</p>
                    <button
                      onClick={handleCopyTelegramId}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Copiar Telegram ID"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Block Status / Button */}
              <div className="mb-6">
                {isBlocked ? (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-center gap-2">
                    <Ban size={18} className="text-red-400" />
                    <span className="text-red-400 text-sm font-medium">Usuario Bloqueado</span>
                  </div>
                ) : (
                  <button
                    onClick={handleBlockUser}
                    disabled={blocking}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      blocking
                        ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-red-900/50 hover:text-red-400'
                    }`}
                  >
                    <Ban size={16} />
                    {blocking ? 'Bloqueando...' : 'Bloquear Usuario'}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-zinc-400">
                  <Calendar size={18} />
                  <div>
                    <p className="text-xs text-zinc-500">Joined</p>
                    <p className="text-sm">{formatDateTime(user?.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-zinc-400">
                  <MessageSquare size={18} />
                  <div>
                    <p className="text-xs text-zinc-500">Last Seen</p>
                    <p className="text-sm">{formatDateTime(user?.last_seen)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-800">
                <p className="text-sm text-zinc-500 mb-2">Total Messages</p>
                <p className="text-2xl font-bold text-white">{messages.length}</p>
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">Conversation History</h3>
            <div className="h-[600px] flex flex-col">
              <ChatUI messages={messages} loading={loading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}