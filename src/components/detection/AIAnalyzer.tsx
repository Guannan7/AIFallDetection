'use client';

import { useState, useCallback } from 'react';
import type { FallDetectionResult, Pose } from '@/lib/fall-detector';

interface AIAnalyzerProps {
  poseData: Pose | null;
  detectionResult: FallDetectionResult | null;
  imageData: string | null;
  mode: 'image' | 'video' | 'camera';
}

export function AIAnalyzer({ poseData, detectionResult, imageData, mode }: AIAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!poseData && !imageData) return;

    setAnalyzing(true);
    setError(null);
    setAnalysis('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poseData: poseData ? {
            keypoints: poseData.keypoints.map(kp => ({
              name: kp.name,
              x: Math.round(kp.x * 100) / 100,
              y: Math.round(kp.y * 100) / 100,
              score: Math.round(kp.score * 100) / 100,
            })),
            score: Math.round(poseData.score * 100) / 100,
            detectionResult: detectionResult ? {
              isFall: detectionResult.isFall,
              confidence: detectionResult.confidence,
              angle: detectionResult.angle,
              aspectRatio: detectionResult.aspectRatio,
              state: detectionResult.state,
            } : null,
          } : null,
          imageData: imageData || null,
          mode,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'AI分析请求失败' }));
        throw new Error(errData.error || 'AI分析请求失败');
      }

      // 流式读取 DeepSeek SSE 响应
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // 解析 SSE 格式: data: {...}\n\n
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                setAnalysis(fullText);
              }
            } catch {
              // 非 JSON 行，跳过
            }
          }
        }
      }

      if (!fullText) {
        setError('AI 未返回有效分析结果');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析失败');
    } finally {
      setAnalyzing(false);
    }
  }, [poseData, detectionResult, imageData, mode]);

  return (
    <div className="space-y-3">
      <button
        onClick={analyze}
        disabled={analyzing || (!poseData && !imageData)}
        className="w-full py-2 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
      >
        {analyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            AI 分析中...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            AI 增强分析
          </>
        )}
      </button>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="p-3 bg-slate-800/50 border border-slate-700/30 rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-xs font-medium text-orange-400">AI 分析结果</span>
            {analyzing && (
              <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse ml-1" />
            )}
          </div>
          <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{analysis}</p>
        </div>
      )}
    </div>
  );
}
