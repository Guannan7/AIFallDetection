'use client';

import { useState, useRef, useCallback } from 'react';
import { FallDetector } from '@/lib/fall-detector';
import type { Pose, FallDetectionResult } from '@/lib/fall-detector';

interface VideoDetectorProps {
  onDetection: (result: FallDetectionResult, pose: Pose) => void;
  onFrame?: (imageData: string) => void;
}

export function VideoDetector({ onDetection, onFrame }: VideoDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef(new FallDetector());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isRunningRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const fpsUpdateTimeRef = useRef(0);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopDetection();

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setLoading(true);

    try {
      const poseEngine = await import('@/lib/pose-engine');
      await poseEngine.initPoseDetector();
    } catch (error) {
      console.error('模型初始化失败:', error);
    }
    setLoading(false);
  }, []);

  const startDetection = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    isRunningRef.current = true;
    setIsPlaying(true);
    detectorRef.current.reset();
    video.play();
    detectLoop();
  }, []);

  const stopDetection = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setIsPlaying(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
  }, []);

  const detectLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    if (video.ended) {
      setIsPlaying(false);
      isRunningRef.current = false;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const poseEngine = await import('@/lib/pose-engine');
      const poses = await poseEngine.estimatePoses(video);

      ctx.drawImage(video, 0, 0);

      if (poses.length > 0) {
        const pose = poses[0];
        const result = detectorRef.current.detect(pose, Date.now());
        poseEngine.drawPoseOverlay(ctx, pose, result.isFall, canvas.width, canvas.height);
        onDetection(result, pose);

        if (onFrame && frameCountRef.current % 30 === 0) {
          onFrame(canvas.toDataURL('image/jpeg', 0.5));
        }
      }
    } catch (error) {
      console.error('视频检测错误:', error);
      ctx.drawImage(video, 0, 0);
    }

    frameCountRef.current++;
    const now = performance.now();
    if (now - fpsUpdateTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      fpsUpdateTimeRef.current = now;
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, [onDetection, onFrame]);

  return (
    <div className="flex flex-col h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          src={videoSrc || undefined}
          className="hidden"
          loop
          muted
          playsInline
          onLoadedData={() => setLoading(false)}
        />
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-contain ${videoSrc ? '' : 'hidden'}`}
        />
        {!videoSrc && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 rounded-lg border-2 border-dashed border-slate-700 cursor-pointer hover:border-orange-500/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 text-sm mb-2">点击上传视频文件</p>
            <p className="text-slate-600 text-xs">支持 MP4、WebM、MOV 格式</p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-300 text-sm">正在加载模型与视频...</p>
            </div>
          </div>
        )}
        {videoSrc && fps > 0 && isPlaying && (
          <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-xs text-emerald-400 font-mono">
            {fps} FPS
          </div>
        )}
      </div>

      {videoSrc && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
          >
            重新选择
          </button>
          {!isPlaying ? (
            <button
              onClick={startDetection}
              className="flex-1 py-2 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              开始检测
            </button>
          ) : (
            <button
              onClick={stopDetection}
              className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              停止检测
            </button>
          )}
        </div>
      )}
    </div>
  );
}
