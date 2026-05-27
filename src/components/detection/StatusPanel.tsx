'use client';

import type { FallDetectionResult } from '@/lib/fall-detector';

interface StatusPanelProps {
  result: FallDetectionResult | null;
  isDetecting: boolean;
  alertCount: number;
}

export function StatusPanel({ result, isDetecting, alertCount }: StatusPanelProps) {
  const stateConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    standing: { label: '正常站立', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    falling: { label: '正在跌倒', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    fallen: { label: '已跌倒!', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    unknown: { label: '待检测', color: 'text-slate-500', bg: 'bg-slate-800/30', border: 'border-slate-700/30' },
  };

  const currentState = result?.state || 'unknown';
  const config = stateConfig[currentState] || stateConfig.unknown;

  return (
    <div className="space-y-4">
      {/* 当前状态 */}
      <div className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
        <div className="flex items-center gap-3">
          {isDetecting && (
            <div className={`w-3 h-3 rounded-full ${currentState === 'fallen' ? 'bg-red-500 animate-pulse' : currentState === 'falling' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
          )}
          <div>
            <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
            {result && result.state !== 'unknown' && (
              <p className="text-xs text-slate-500 mt-0.5">{result.details}</p>
            )}
          </div>
        </div>
      </div>

      {/* 数据指标 */}
      {result && result.state !== 'unknown' && (
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="置信度"
            value={`${(result.confidence * 100).toFixed(1)}%`}
            color={result.confidence > 0.5 ? 'text-red-400' : 'text-emerald-400'}
          />
          <MetricCard
            label="躯干角度"
            value={`${result.angle.toFixed(1)}°`}
            color={result.angle > 45 ? 'text-red-400' : 'text-emerald-400'}
          />
          <MetricCard
            label="宽高比"
            value={result.aspectRatio.toFixed(2)}
            color={result.aspectRatio > 0.8 ? 'text-red-400' : 'text-emerald-400'}
          />
          <MetricCard
            label="移动速度"
            value={result.velocity.toFixed(3)}
            color={result.velocity > 0.15 ? 'text-amber-400' : 'text-slate-400'}
          />
        </div>
      )}

      {/* 置信度进度条 */}
      {result && result.state !== 'unknown' && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-500">跌倒置信度</span>
            <span className="text-xs text-slate-400 font-mono">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                result.confidence > 0.7 ? 'bg-red-500' : result.confidence > 0.4 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.max(result.confidence * 100, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* 报警计数 */}
      {alertCount > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-400">报警 {alertCount} 次</p>
            <p className="text-xs text-red-400/60">检测到跌倒事件</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/30 rounded-lg p-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-mono font-semibold ${color} mt-0.5`}>{value}</p>
    </div>
  );
}
