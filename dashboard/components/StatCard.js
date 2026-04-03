'use client';

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function StatCard({ title, value, change, changeType = 'neutral', icon: Icon }) {
  const changeColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-zinc-400',
  };

  const ChangeIcon = changeType === 'positive' ? ArrowUpRight :
                     changeType === 'negative' ? ArrowDownRight : Minus;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-sm mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${changeColors[changeType]}`}>
              <ChangeIcon size={16} />
              <span>{change}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-zinc-800 rounded-lg">
            <Icon size={24} className="text-zinc-400" />
          </div>
        )}
      </div>
    </div>
  );
}