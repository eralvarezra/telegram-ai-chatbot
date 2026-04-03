'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Table from '@/components/Table';
import { formatRelativeTime } from '@/lib/utils';
import { getConversations, blockUser, checkIfBlocked } from '@/lib/api';
import { Ban, Copy, MessageSquare } from 'lucide-react';

export default function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState(new Set());
  const [blockingId, setBlockingId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getConversations();
        setConversations(data);

        // Check blocked status for each user
        for (const conv of data) {
          try {
            const result = await checkIfBlocked(conv.telegram_id);
            if (result.isBlocked) {
              setBlockedUsers(prev => new Set([...prev, conv.telegram_id]));
            }
          } catch (e) {
            // Ignore errors for individual blocked checks
          }
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
        alert('Error al cargar conversaciones. Verifica que el servidor backend esté corriendo.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleBlockUser = async (telegramId, username, displayName, event) => {
    event.stopPropagation(); // Prevent row click navigation

    if (blockingId) return; // Already blocking someone

    setBlockingId(telegramId);
    try {
      await blockUser(telegramId, username || null, displayName || null, 'Blocked from conversations');
      setBlockedUsers(prev => new Set([...prev, telegramId]));
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Error al bloquear usuario');
    } finally {
      setBlockingId(null);
    }
  };

  const handleCopyTelegramId = (telegramId, event) => {
    event.stopPropagation(); // Prevent row click navigation
    navigator.clipboard.writeText(telegramId);
  };

  const columns = [
    {
      key: 'username',
      label: 'User',
      render: (value, row) => {
        const displayName = row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || null;
        const displayChar = displayName?.charAt(0)?.toUpperCase() || '?';
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-xs text-white">{displayChar}</span>
            </div>
            <div>
              <span className="font-medium text-white">{displayName || 'Unknown'}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">ID: {row.telegram_id}</span>
                <button
                  onClick={(e) => handleCopyTelegramId(row.telegram_id, e)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Copiar Telegram ID"
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'last_message',
      label: 'Last Message',
      render: (value) => (
        <span className="text-zinc-400 truncate max-w-xs">{value}</span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (value) => (
        <span className="text-zinc-500">{formatRelativeTime(value)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => {
        const isBlocked = blockedUsers.has(row.telegram_id);
        const isBlocking = blockingId === row.telegram_id;
        const displayName = row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || null;

        return (
          <button
            onClick={(e) => handleBlockUser(row.telegram_id, row.username, displayName, e)}
            disabled={isBlocked || isBlocking}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isBlocked
                ? 'bg-red-900/30 text-red-400 cursor-not-allowed'
                : isBlocking
                  ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-red-900/50 hover:text-red-400'
            }`}
            title={isBlocked ? 'Usuario bloqueado' : 'Bloquear usuario'}
          >
            <Ban size={14} />
            {isBlocked ? 'Bloqueado' : isBlocking ? 'Bloqueando...' : 'Bloquear'}
          </button>
        );
      },
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Conversations" />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Conversations</h2>
          <p className="text-zinc-400 mt-1">View and manage active conversations</p>
        </div>

        <Table
          columns={columns}
          data={conversations}
          loading={loading}
          onRowClick={(row) => router.push(`/users/${row.user_id}`)}
        />
      </div>
    </div>
  );
}