'use client';

import { useState, useRef, useCallback } from 'react';
import { FallDetector } from '@/lib/fall-detector';
import type { Pose, FallDetectionResult } from '@/lib/fall-detector';

interface ImageDetectorProps {
  onDetection: (result: FallDetectionResult, pose: Pose, imageData: string) => void;
}

export function ImageDetector({ onDetection }: ImageDetectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<FallDetectionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setDetectionResult(null);

    try {
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
      });

      setPreview(url);

      // 动态加载 pose engine
      const poseEngine = await import('@/lib/pose-engine');
      await poseEngine.initPoseDetector();

      const poses = await poseEngine.estimatePoses(img);

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      if (poses.length > 0) {
        const pose = poses[0];
        const detector = new FallDetector();
        const result = detector.detect(pose);

        poseEngine.drawPoseOverlay(ctx, pose, result.isFall, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setDetectionResult(result);
        onDetection(result, pose, imageData);
      } else {
        const noResult: FallDetectionResult = {
          isFall: false,
          confidence: 0,
          angle: 0,
          aspectRatio: 0,
          headHipRatio: 0,
          velocity: 0,
          state: 'unknown',
          details: '未检测到人体',
        };
        setDetectionResult(noResult);
        onDetection(noResult, { keypoints: [], score: 0 }, canvas.toDataURL('image/jpeg', 0.8));
      }
    } catch (error) {
      console.error('图片检测失败:', error);
    } finally {
      setLoading(false);
    }
  }, [onDetection]);

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain ${preview ? '' : 'hidden'}`}
        />
        {!preview && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 rounded-lg border-2 border-dashed border-slate-700 cursor-pointer hover:border-orange-500/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 text-sm mb-2">点击或拖拽上传图片</p>
            <p className="text-slate-600 text-xs">支持 JPG、PNG、WebP 格式</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-300 text-sm">正在分析图片...</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部检测结果 */}
      {detectionResult && detectionResult.state !== 'unknown' && (
        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">检测结果</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              detectionResult.isFall
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {detectionResult.isFall ? '跌倒' : '正常'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xs text-slate-500">置信度</p>
              <p className="text-sm font-mono font-semibold text-slate-300">{(detectionResult.confidence * 100).toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">躯干角度</p>
              <p className="text-sm font-mono font-semibold text-slate-300">{detectionResult.angle.toFixed(1)}°</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500">宽高比</p>
              <p className="text-sm font-mono font-semibold text-slate-300">{detectionResult.aspectRatio.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
      {detectionResult && detectionResult.state === 'unknown' && (
        <div className="mt-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 text-center">
          <p className="text-xs text-slate-500">{detectionResult.details}</p>
        </div>
      )}

      {preview && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          重新上传
        </button>
      )}
    </div>
  );
}
