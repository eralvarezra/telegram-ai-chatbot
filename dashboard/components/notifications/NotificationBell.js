'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, Trash2, ChevronRight, DollarSign, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/src/i18n';

// Icon mapping for notification types
const typeIcons = {
  payment: DollarSign,
  warning: AlertTriangle,
  suggestion: Lightbulb,
  info: Info
};

// Priority colors
const priorityColors = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-zinc-500'
};

// Time ago formatter
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
};

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    panelOpen,
    setPanelOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    groupedNotifications,
    loading
  } = useNotifications();

  const { t } = useI18n();
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setPanelOpen(false);
      }
    };

    if (panelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [panelOpen, setPanelOpen]);

  const groups = groupedNotifications();
  const hasNotifications = notifications.length > 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs font-medium text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="font-semibold text-white">
                {t('notifications.title') || 'Notifications'}
              </h3>
              <div className="flex items-center gap-2">
                {hasNotifications && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {t('notifications.markAllRead') || 'Mark all read'}
                    </button>
                    <button
                      onClick={clearAll}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      title={t('notifications.clearAll') || 'Clear all'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-1 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-600 border-t-white"></div>
                </div>
              ) : !hasNotifications ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                    <Bell size={20} className="text-zinc-500" />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    {t('notifications.empty') || "You're all caught up 🎉"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {['today', 'yesterday', 'thisWeek', 'earlier'].map((groupKey) => {
                    const group = groups[groupKey];
                    if (!group || group.length === 0) return null;

                    const groupLabel = {
                      today: t('notifications.today') || 'Today',
                      yesterday: t('notifications.yesterday') || 'Yesterday',
                      thisWeek: t('notifications.thisWeek') || 'This Week',
                      earlier: t('notifications.earlier') || 'Earlier'
                    };

                    return (
                      <div key={groupKey}>
                        <div className="px-4 py-2 text-xs text-zinc-500 font-medium bg-zinc-900/50">
                          {groupLabel[groupKey]}
                        </div>
                        {group.map((notification) => (
                          <NotificationItem
                            key={notification.id}
                            notification={notification}
                            onMarkRead={() => markAsRead(notification.id)}
                            onDelete={() => deleteNotification(notification.id)}
                            onClose={() => setPanelOpen(false)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({ notification, onMarkRead, onDelete, onClose }) {
  const { t } = useI18n();
  const Icon = typeIcons[notification.type] || Info;
  const isUnread = !notification.is_read;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative px-4 py-3 hover:bg-zinc-800/50 transition-colors cursor-pointer group ${
        isUnread ? 'bg-zinc-800/30' : ''
      }`}
      onClick={() => {
        onMarkRead();
        if (notification.action_url) {
          onClose();
          window.location.href = notification.action_url;
        }
      }}
    >
      {/* Priority indicator */}
      {isUnread && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityColors[notification.priority] || 'bg-blue-500'}`} />
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          notification.type === 'payment' ? 'bg-green-500/20 text-green-400' :
          notification.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
          notification.type === 'suggestion' ? 'bg-blue-500/20 text-blue-400' :
          'bg-zinc-700/50 text-zinc-400'
        }`}>
          <Icon size={16} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isUnread ? 'text-white' : 'text-zinc-300'}`}>
            {notification.title}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {timeAgo(notification.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-start gap-1">
          {notification.action_url && notification.action_text && (
            <span className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
              {notification.action_text}
              <ChevronRight size={12} />
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all"
            title={t('notifications.delete') || 'Delete'}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}