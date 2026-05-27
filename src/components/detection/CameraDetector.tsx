'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FallDetector } from '@/lib/fall-detector';
import type { Pose, FallDetectionResult } from '@/lib/fall-detector';

interface CameraDetectorProps {
  onDetection: (result: FallDetectionResult, pose: Pose) => void;
  onFrame?: (imageData: string) => void;
  enabled: boolean;
  sensitivity: number; // 0-1
}

export function CameraDetector({ onDetection, onFrame, enabled, sensitivity }: CameraDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef(new FallDetector());
  const isRunningRef = useRef(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [fps, setFps] = useState(0);
  const fpsUpdateTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  const startCamera = useCallback(async () => {
    try {
      setModelStatus('loading');
      // 动态加载 pose engine
      const poseEngine = await import('@/lib/pose-engine');
      await poseEngine.initPoseDetector();
      setModelStatus('ready');

      // 获取摄像头
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsStreaming(true);
          isRunningRef.current = true;
          detectorRef.current.reset();
          detectLoop();
        };
      }
    } catch (error) {
      console.error('摄像头启动失败:', error);
      setModelStatus('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    detectorRef.current.reset();
  }, []);

  const detectLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸匹配视频
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const poseEngine = await import('@/lib/pose-engine');
      const poses = await poseEngine.estimatePoses(video);

      if (poses.length > 0) {
        const pose = poses[0];
        const result = detectorRef.current.detect(pose, Date.now());

        ctx.drawImage(video, 0, 0);
        poseEngine.drawPoseOverlay(ctx, pose, result.isFall, canvas.width, canvas.height);

        onDetection(result, pose);

        if (onFrame && frameCountRef.current % 30 === 0) {
          onFrame(canvas.toDataURL('image/jpeg', 0.5));
        }
      } else {
        ctx.drawImage(video, 0, 0);
      }
    } catch (error) {
      console.error('检测错误:', error);
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

  useEffect(() => {
    if (enabled && !isStreaming) {
      startCamera();
    } else if (!enabled && isStreaming) {
      stopCamera();
    }
  }, [enabled, isStreaming, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
      />
      {!isStreaming && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 rounded-lg">
          <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-400 text-sm">点击「开始检测」启动摄像头</p>
        </div>
      )}
      {isStreaming && fps > 0 && (
        <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-xs text-emerald-400 font-mono">
          {fps} FPS
        </div>
      )}
      {modelStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-lg">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-300 text-sm">正在加载模型...</p>
          </div>
        </div>
      )}
    </div>
  );
}
