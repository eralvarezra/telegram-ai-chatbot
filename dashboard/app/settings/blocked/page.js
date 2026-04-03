'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { Ban, UserX, Plus, Search, Trash2, AlertCircle } from 'lucide-react';

const API_URL = 'http://localhost:3000';

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      setError(null);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/blocked-users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch blocked users');
      }

      const data = await res.json();
      setBlockedUsers(data.data || []);
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      setError('Could not connect to backend. Make sure server is running on port 3000.');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (e) => {
    e.preventDefault();
    if (!telegramId.trim()) {
      setError('Telegram ID is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/blocked-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          telegramId: telegramId.trim(),
          username: username.trim() || null,
          displayName: displayName.trim() || null,
          reason: reason.trim() || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to block user');
      }

      setSuccess('User blocked successfully');
      setBlockedUsers([data.data, ...blockedUsers]);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (blockId) => {
    if (!confirm('Are you sure you want to unblock this user?')) {
      return;
    }

    try {
      setError(null);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/blocked-users/${blockId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to unblock user');
      }

      setSuccess('User unblocked successfully');
      setBlockedUsers(blockedUsers.filter(u => u.id !== blockId));
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setTelegramId('');
    setUsername('');
    setDisplayName('');
    setReason('');
    setShowForm(false);
  };

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Filter users by search
  const filteredUsers = blockedUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.telegram_id?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.display_name?.toLowerCase().includes(query) ||
      user.reason?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen">
      <Header title="Blocked Users" />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Blocked Users</h2>
            <p className="text-zinc-400 mt-1">Manage users that the bot will ignore</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showForm ? (
              <>
                <UserX size={18} />
                Cancel
              </>
            ) : (
              <>
                <Plus size={18} />
                Block User
              </>
            )}
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-4 bg-green-900/50 border border-green-800 rounded-lg text-green-200 flex items-center gap-2">
            <Ban size={18} />
            {success}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-800 rounded-lg text-red-200 flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Block a New User</h3>
            <form onSubmit={handleBlockUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Telegram ID * <span className="text-zinc-600">(Required)</span>
                  </label>
                  <input
                    type="text"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="e.g., 123456789"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Username <span className="text-zinc-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g., @username"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Display Name <span className="text-zinc-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Reason <span className="text-zinc-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Spam, harassment..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Blocking...' : 'Block User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-900/50 rounded-lg">
                <Ban className="text-red-400" size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Blocked</p>
                <p className="text-2xl font-bold text-white">{blockedUsers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-lg">
                <UserX className="text-zinc-400" size={20} />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Filter</p>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="bg-transparent text-white focus:outline-none w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <Ban size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">
              {searchQuery ? 'No blocked users match your search' : 'No blocked users yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Block your first user
              </button>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 text-zinc-400 font-medium">Telegram ID</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Username</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Display Name</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Reason</th>
                  <th className="text-left p-4 text-zinc-400 font-medium">Blocked On</th>
                  <th className="text-right p-4 text-zinc-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/50"
                  >
                    <td className="p-4">
                      <code className="text-blue-400 bg-zinc-800 px-2 py-1 rounded">
                        {user.telegram_id}
                      </code>
                    </td>
                    <td className="p-4 text-white">
                      {user.username ? (
                        <span className="text-zinc-300">{user.username}</span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="p-4 text-white">
                      {user.display_name ? (
                        <span className="text-zinc-300">{user.display_name}</span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="p-4 text-white">
                      {user.reason ? (
                        <span className="text-zinc-300">{user.reason}</span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-400 text-sm">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleUnblock(user.id)}
                        className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        title="Unblock user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 bg-blue-900/30 border border-blue-800/50 rounded-xl p-4">
          <h4 className="text-blue-300 font-medium mb-2 flex items-center gap-2">
            <AlertCircle size={18} />
            How it works
          </h4>
          <ul className="text-zinc-400 text-sm space-y-1">
            <li>- Blocked users are completely ignored by the bot</li>
            <li>- No responses, no AI triggers, no conversation logging</li>
            <li>- Users are identified by Telegram ID (username changes are tracked)</li>
            <li>- Blocking takes effect immediately across all bot instances</li>
          </ul>
        </div>
      </div>
    </div>
  );
}