'use client';

import type { DetectionRecord } from '@/lib/fall-detector';

interface HistoryPanelProps {
  records: DetectionRecord[];
  stats: {
    total: number;
    falls: number;
    normal: number;
    byType: { image: number; video: number; camera: number };
  };
  onClear: () => void;
  onDelete: (id: string) => void;
}

export function HistoryPanel({ records, stats, onClear, onDelete }: HistoryPanelProps) {
  const typeLabels = {
    image: '图片',
    video: '视频',
    camera: '摄像头',
  };

  const typeIcons = {
    image: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    video: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    camera: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-col h-full">
      {/* 统计概览 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-slate-200 font-mono">{stats.total}</p>
          <p className="text-xs text-slate-500 mt-1">总检测</p>
        </div>
        <div className="bg-red-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-400 font-mono">{stats.falls}</p>
          <p className="text-xs text-slate-500 mt-1">跌倒</p>
        </div>
        <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400 font-mono">{stats.normal}</p>
          <p className="text-xs text-slate-500 mt-1">正常</p>
        </div>
      </div>

      {/* 类型分布 */}
      <div className="flex gap-2 mb-4">
        {(['image', 'video', 'camera'] as const).map((type) => (
          <div key={type} className="flex items-center gap-1.5 bg-slate-800/30 px-2 py-1 rounded text-xs text-slate-400">
            {typeIcons[type]}
            <span>{typeLabels[type]}: {stats.byType[type]}</span>
          </div>
        ))}
      </div>

      {/* 历史列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">暂无检测记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div
                key={record.id}
                className={`p-3 rounded-lg border transition-colors ${
                  record.isFall
                    ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                    : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      record.isFall
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {record.isFall ? '跌倒' : '正常'}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {typeIcons[record.type]}
                      {typeLabels[record.type]}
                    </span>
                  </div>
                  <button
                    onClick={() => onDelete(record.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{record.details}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-slate-600 font-mono">
                    {new Date(record.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                  <span className="text-xs text-slate-600 font-mono">
                    {(record.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 清空按钮 */}
      {records.length > 0 && (
        <button
          onClick={onClear}
          className="mt-3 w-full py-2 px-4 bg-slate-800/50 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg text-sm transition-colors"
        >
          清空记录
        </button>
      )}
    </div>
  );
}
