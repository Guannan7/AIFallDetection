'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { StatusPanel } from '@/components/detection/StatusPanel';
import { HistoryPanel } from '@/components/detection/HistoryPanel';
import { AIAnalyzer } from '@/components/detection/AIAnalyzer';
import { useDetectionHistory } from '@/hooks/use-detection-history';
import { useAlert } from '@/hooks/use-alert';
import type { FallDetectionResult, Pose, DetectionRecord } from '@/lib/fall-detector';

// Dynamic import detection components with SSR disabled (TensorFlow.js is browser-only)
const CameraDetector = dynamic(
  () => import('@/components/detection/CameraDetector').then(m => ({ default: m.CameraDetector })),
  { ssr: false }
);
const ImageDetector = dynamic(
  () => import('@/components/detection/ImageDetector').then(m => ({ default: m.ImageDetector })),
  { ssr: false }
);
const VideoDetector = dynamic(
  () => import('@/components/detection/VideoDetector').then(m => ({ default: m.VideoDetector })),
  { ssr: false }
);

type DetectionMode = 'camera' | 'video' | 'image';

export default function HomePage() {
  const [mode, setMode] = useState<DetectionMode>('camera');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [currentResult, setCurrentResult] = useState<FallDetectionResult | null>(null);
  const [currentPose, setCurrentPose] = useState<Pose | null>(null);
  const [currentImageData, setCurrentImageData] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.5);
  const lastAlertTimeRef = useRef(0);
  const { records, addRecord, clearRecords, deleteRecord, stats } = useDetectionHistory();
  const { alertActive, alertMessage, triggerAlert, dismissAlert } = useAlert();

  const handleDetection = useCallback((result: FallDetectionResult, pose: Pose, imageData?: string) => {
    setCurrentResult(result);
    setCurrentPose(pose);
    if (imageData) {
      setCurrentImageData(imageData);
    }

    // 跌倒报警
    if (result.isFall) {
      const now = Date.now();
      if (now - lastAlertTimeRef.current > 5000) {
        lastAlertTimeRef.current = now;
        setAlertCount((prev) => prev + 1);
        triggerAlert(`检测到跌倒! 置信度: ${(result.confidence * 100).toFixed(0)}%`);

        // 添加历史记录
        const record: DetectionRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          type: mode,
          isFall: true,
          confidence: result.confidence,
          imageData,
          details: result.details,
        };
        addRecord(record);
      }
    }
  }, [mode, triggerAlert, addRecord]);

  const handleImageDetection = useCallback((result: FallDetectionResult, pose: Pose, imageData: string) => {
    setCurrentResult(result);
    setCurrentPose(pose);
    setCurrentImageData(imageData);

    const record: DetectionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type: 'image',
      isFall: result.isFall,
      confidence: result.confidence,
      imageData,
      details: result.details,
    };
    addRecord(record);

    if (result.isFall) {
      setAlertCount((prev) => prev + 1);
      triggerAlert(`图片中检测到跌倒! 置信度: ${(result.confidence * 100).toFixed(0)}%`);
    }
  }, [addRecord, triggerAlert]);

  const handleFrame = useCallback((imageData: string) => {
    setCurrentImageData(imageData);
  }, []);

  const modeConfig: Record<DetectionMode, { label: string; icon: React.ReactNode }> = {
    camera: { label: '摄像头', icon: <CameraIcon /> },
    video: { label: '视频', icon: <VideoIcon /> },
    image: { label: '图片', icon: <ImageIcon /> },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* 报警弹窗 */}
      {alertActive && (
        <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
          <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-bold text-lg">{alertMessage}</span>
            </div>
            <button onClick={dismissAlert} className="p-1 hover:bg-red-500 rounded transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">跌倒检测系统</h1>
              <p className="text-xs text-slate-500">AI Fall Detection</p>
            </div>
          </div>

          {/* 模式切换 */}
          <div className="flex bg-slate-900 rounded-lg p-1 gap-1">
            {(Object.keys(modeConfig) as DetectionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  if (m !== 'camera') setCameraEnabled(false);
                  setCurrentResult(null);
                  setCurrentPose(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                  mode === m
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {modeConfig[m].icon}
                {modeConfig[m].label}
              </button>
            ))}
          </div>

          {/* 历史按钮 */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              showHistory ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            历史记录
            {stats.falls > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-mono">{stats.falls}</span>
            )}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-4">
          {/* 左侧：检测区域 */}
          <div className="flex-1 min-w-0">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cameraEnabled || mode !== 'camera' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-sm text-slate-400">
                    {mode === 'camera' ? '摄像头实时检测' : mode === 'video' ? '视频分析' : '图片分析'}
                  </span>
                </div>
                {mode === 'camera' && (
                  <button
                    onClick={() => setCameraEnabled(!cameraEnabled)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      cameraEnabled
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
                    }`}
                  >
                    {cameraEnabled ? '停止检测' : '开始检测'}
                  </button>
                )}
              </div>
              <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                {mode === 'camera' && (
                  <CameraDetector
                    onDetection={handleDetection}
                    onFrame={handleFrame}
                    enabled={cameraEnabled}
                    sensitivity={sensitivity}
                  />
                )}
                {mode === 'video' && (
                  <VideoDetector
                    onDetection={handleDetection}
                    onFrame={handleFrame}
                  />
                )}
                {mode === 'image' && (
                  <ImageDetector
                    onDetection={handleImageDetection}
                  />
                )}
              </div>
            </div>

            {/* 灵敏度控制 */}
            <div className="mt-3 bg-slate-900 rounded-xl border border-slate-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">检测灵敏度</span>
                <span className="text-xs text-slate-400 font-mono">{(sensitivity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sensitivity * 100}
                onChange={(e) => setSensitivity(Number(e.target.value) / 100)}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>低</span>
                <span>中</span>
                <span>高</span>
              </div>
            </div>
          </div>

          {/* 右侧：状态面板 */}
          <div className="w-80 flex-shrink-0 space-y-4">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                实时状态
              </h3>
              <StatusPanel
                result={currentResult}
                isDetecting={cameraEnabled || mode !== 'camera'}
                alertCount={alertCount}
              />
            </div>

            {/* AI 增强分析 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI 增强分析
              </h3>
              <AIAnalyzer
                poseData={currentPose}
                detectionResult={currentResult}
                imageData={currentImageData}
                mode={mode}
              />
            </div>
          </div>
        </div>

        {/* 历史记录抽屉 */}
        {showHistory && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowHistory(false)} />
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-slate-950 border-l border-slate-800 p-4 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-200">检测历史</h3>
                <button onClick={() => setShowHistory(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <HistoryPanel
                records={records}
                stats={stats}
                onClear={clearRecords}
                onDelete={deleteRecord}
              />
            </div>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-sm border-t border-slate-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>模式: {modeConfig[mode].label}</span>
            <span>记录: {stats.total}</span>
            <span>报警: {alertCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${cameraEnabled || mode !== 'camera' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            <span>{cameraEnabled || mode !== 'camera' ? '运行中' : '待机'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
