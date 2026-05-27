/**
 * TensorFlow.js 姿态估计引擎（CDN 加载方式）
 * 使用 MoveNet SinglePose Lightning 模型
 * 
 * TensorFlow.js 和 MoveNet 模型通过 CDN 在浏览器运行时加载，
 * 完全避免服务端打包问题。
 */

import type { Keypoint, Pose } from './fall-detector';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

// CDN URLs for TensorFlow.js
const TFJS_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const POSE_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js';

let detector: PoseDetector | null = null;
let modelStatus: ModelStatus = 'idle';
let scriptsLoaded = false;

// Type definitions for the global objects
interface TFGlobal {
  ready(): Promise<void>;
  setBackend(backend: string): Promise<void>;
}

interface PoseDetectionGlobal {
  SupportedModels: {
    MoveNet: string;
  };
  movenet: {
    modelType: {
      SINGLEPOSE_LIGHTNING: string;
    };
  };
  createDetector(model: string, config: Record<string, unknown>): Promise<PoseDetector>;
}

interface PoseDetector {
  estimatePoses(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<Array<{
    keypoints: Array<{ x: number; y: number; score: number | null; name: string | null }>;
    score: number | null;
  }>>;
  dispose(): void;
}

/**
 * 获取当前模型状态
 */
export function getModelStatus(): ModelStatus {
  return modelStatus;
}

/**
 * 动态加载 CDN 脚本
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已存在
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * 确保 TensorFlow.js 脚本已加载
 */
async function ensureScriptsLoaded(): Promise<void> {
  if (scriptsLoaded) return;

  await loadScript(TFJS_CDN);
  await loadScript(POSE_CDN);
  scriptsLoaded = true;
}

/**
 * 获取全局 TF 对象
 */
function getTF(): TFGlobal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).tf as TFGlobal;
}

/**
 * 获取全局 poseDetection 对象
 */
function getPoseDetection(): PoseDetectionGlobal {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).poseDetection as PoseDetectionGlobal;
}

/**
 * 初始化 MoveNet 模型
 */
export async function initPoseDetector(): Promise<NonNullable<typeof detector>> {
  if (detector && modelStatus === 'ready') {
    return detector;
  }

  try {
    modelStatus = 'loading';

    // 加载 CDN 脚本
    await ensureScriptsLoaded();

    const tf = getTF();
    const poseDetection = getPoseDetection();

    // 确保后端就绪
    await tf.ready();
    await tf.setBackend('webgl');

    // 创建 MoveNet SinglePose Lightning 检测器
    const model = poseDetection.SupportedModels.MoveNet;
    detector = await poseDetection.createDetector(model, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });

    modelStatus = 'ready';
    return detector;
  } catch (error) {
    modelStatus = 'error';
    console.error('模型初始化失败:', error);
    throw error;
  }
}

/**
 * 从视频源检测姿态
 */
export async function estimatePoses(
  video: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Pose[]> {
  if (!detector || modelStatus !== 'ready') {
    throw new Error('模型未就绪，请先调用 initPoseDetector()');
  }

  // 验证视频源尺寸
  if ('videoWidth' in video && (video as HTMLVideoElement).videoWidth === 0) {
    return [];
  }

  const poses = await detector.estimatePoses(video);

  return poses.map((pose) => ({
    keypoints: pose.keypoints.map((kp) => ({
      x: kp.x,
      y: kp.y,
      score: kp.score ?? 0,
      name: kp.name ?? '',
    })),
    score: pose.score ?? 0,
  }));
}

/**
 * 绘制姿态关键点和骨架
 */
export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  pose: Pose,
  isFall: boolean,
  width: number,
  height: number
): void {
  const keypoints = pose.keypoints;
  const color = isFall ? '#ef4444' : '#10b981';
  const secondaryColor = isFall ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)';

  // 骨架连接关系
  const skeleton = [
    [5, 6],   // 左肩 - 右肩
    [5, 7],   // 左肩 - 左肘
    [7, 9],   // 左肘 - 左腕
    [6, 8],   // 右肩 - 右肘
    [8, 10],  // 右肘 - 右腕
    [5, 11],  // 左肩 - 左臀
    [6, 12],  // 右肩 - 右臀
    [11, 12], // 左臀 - 右臀
    [11, 13], // 左臀 - 左膝
    [13, 15], // 左膝 - 左踝
    [12, 14], // 右臀 - 右膝
    [14, 16], // 右膝 - 右踝
    [0, 5],   // 鼻 - 左肩
    [0, 6],   // 鼻 - 右肩
  ];

  // 绘制边界框
  const validPoints = keypoints.filter(kp => kp.score >= 0.3);
  if (validPoints.length >= 4) {
    const xs = validPoints.map(kp => kp.x);
    const ys = validPoints.map(kp => kp.y);
    const padding = 20;
    const minX = Math.max(0, Math.min(...xs) - padding);
    const minY = Math.max(0, Math.min(...ys) - padding);
    const maxX = Math.min(width, Math.max(...xs) + padding);
    const maxY = Math.min(height, Math.max(...ys) + padding);

    ctx.strokeStyle = color;
    ctx.lineWidth = isFall ? 3 : 2;
    ctx.setLineDash(isFall ? [] : [5, 5]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.setLineDash([]);

    ctx.fillStyle = secondaryColor;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // 跌倒标签
    if (isFall) {
      const label = '跌倒检测!';
      ctx.font = 'bold 16px sans-serif';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(minX, minY - 28, textWidth + 16, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, minX + 8, minY - 10);
    }
  }

  // 绘制骨架线
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (const [i, j] of skeleton) {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];
    if (kp1 && kp2 && kp1.score >= 0.3 && kp2.score >= 0.3) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.stroke();
    }
  }

  // 绘制关键点
  for (const kp of keypoints) {
    if (kp.score >= 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, isFall ? 5 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/**
 * 销毁检测器，释放资源
 */
export async function disposeDetector(): Promise<void> {
  if (detector) {
    detector.dispose();
    detector = null;
  }
  modelStatus = 'idle';
}
