'use client';

import { useRef, useEffect } from 'react';
import { formatRelativeTime } from '@/lib/utils';

export default function ChatUI({ messages, loading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-center">
        <p className="text-zinc-500">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={msg.id || index}
            className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`
                max-w-[80%] rounded-xl px-4 py-2
                ${msg.role === 'user'
                  ? 'bg-zinc-800 text-white'
                  : 'bg-blue-600 text-white'
                }
              `}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs text-zinc-400 mt-1">
                {formatRelativeTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}