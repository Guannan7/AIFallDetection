/**
 * 跌倒检测引擎
 * 基于 TensorFlow.js + MoveNet 姿态估计
 * 
 * MoveNet 17个关键点索引:
 * 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
 * 5: left_shoulder, 6: right_shoulder, 7: left_elbow, 8: right_elbow
 * 9: left_wrist, 10: right_wrist, 11: left_hip, 12: right_hip
 * 13: left_knee, 14: right_knee, 15: left_ankle, 16: right_ankle
 */

export interface Keypoint {
  x: number;
  y: number;
  score: number;
  name: string;
}

export interface Pose {
  keypoints: Keypoint[];
  score: number;
}

export interface FallDetectionResult {
  isFall: boolean;
  confidence: number; // 0-1
  angle: number; // 躯干倾斜角度（度）
  aspectRatio: number; // 身体宽高比
  headHipRatio: number; // 头部相对臀部的垂直距离比
  velocity: number; // 帧间位移速度
  state: 'standing' | 'falling' | 'fallen' | 'unknown';
  details: string;
}

export interface DetectionRecord {
  id: string;
  timestamp: number;
  type: 'image' | 'video' | 'camera';
  isFall: boolean;
  confidence: number;
  imageData?: string; // base64 截图
  details: string;
}

// 关键点索引常量
const NOSE = 0;
const LEFT_SHOULDER = 5;
const RIGHT_SHOULDER = 6;
const LEFT_HIP = 11;
const RIGHT_HIP = 12;
const LEFT_KNEE = 13;
const RIGHT_KNEE = 14;
const LEFT_ANKLE = 15;
const RIGHT_ANKLE = 16;

// 置信度阈值
const MIN_KEYPOINT_SCORE = 0.3;
const FALL_ANGLE_THRESHOLD = 45; // 躯干倾斜超过45度视为跌倒
const ASPECT_RATIO_THRESHOLD = 0.8; // 宽高比大于0.8（接近水平）
const HEAD_HIP_RATIO_THRESHOLD = 0.2; // 头部低于臀部一定比例
const VELOCITY_THRESHOLD = 0.15; // 帧间高速移动

/**
 * 计算两点之间的中点
 */
function midpoint(a: Keypoint, b: Keypoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 计算两点之间的角度（相对垂直方向）
 */
function angleFromVertical(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // 相对垂直方向的角度
  const angle = Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);
  return angle;
}

/**
 * 获取有效的关键点
 */
function getValidKeypoint(keypoints: Keypoint[], index: number): Keypoint | null {
  const kp = keypoints[index];
  if (kp && kp.score >= MIN_KEYPOINT_SCORE) {
    return kp;
  }
  return null;
}

/**
 * 计算身体边界框的宽高比
 */
function calculateAspectRatio(keypoints: Keypoint[]): number {
  const validPoints = keypoints.filter(kp => kp.score >= MIN_KEYPOINT_SCORE);
  if (validPoints.length < 4) return 0;

  const xs = validPoints.map(kp => kp.x);
  const ys = validPoints.map(kp => kp.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  if (height === 0) return 0;
  return width / height;
}

export class FallDetector {
  private previousPose: Pose | null = null;
  private previousTimestamp: number = 0;
  private fallFrameCount: number = 0;
  private readonly FALL_CONFIRM_FRAMES = 3; // 连续3帧确认跌倒

  /**
   * 检测单帧姿态是否为跌倒
   */
  detect(pose: Pose, timestamp?: number): FallDetectionResult {
    const now = timestamp || Date.now();
    const keypoints = pose.keypoints;

    // 获取关键部位
    const nose = getValidKeypoint(keypoints, NOSE);
    const leftShoulder = getValidKeypoint(keypoints, LEFT_SHOULDER);
    const rightShoulder = getValidKeypoint(keypoints, RIGHT_SHOULDER);
    const leftHip = getValidKeypoint(keypoints, LEFT_HIP);
    const rightHip = getValidKeypoint(keypoints, RIGHT_HIP);
    const leftKnee = getValidKeypoint(keypoints, LEFT_KNEE);
    const rightKnee = getValidKeypoint(keypoints, RIGHT_KNEE);
    const leftAnkle = getValidKeypoint(keypoints, LEFT_ANKLE);
    const rightAnkle = getValidKeypoint(keypoints, RIGHT_ANKLE);

    // 检查关键点是否足够
    const essentialPoints = [leftShoulder, rightShoulder, leftHip, rightHip].filter(Boolean);
    if (essentialPoints.length < 3) {
      return {
        isFall: false,
        confidence: 0,
        angle: 0,
        aspectRatio: 0,
        headHipRatio: 0,
        velocity: 0,
        state: 'unknown',
        details: '关键点不足，无法判断',
      };
    }

    // 1. 计算躯干倾斜角度
    const shoulderMid = midpoint(
      leftShoulder || rightShoulder!,
      rightShoulder || leftShoulder!
    );
    const hipMid = midpoint(
      leftHip || rightHip!,
      rightHip || leftHip!
    );
    const torsoAngle = angleFromVertical(shoulderMid, hipMid);

    // 2. 计算身体宽高比
    const aspectRatio = calculateAspectRatio(keypoints);

    // 3. 计算头部相对臀部位置
    let headHipRatio = 0;
    if (nose && (leftHip || rightHip)) {
      const hipM = midpoint(leftHip || rightHip!, rightHip || leftHip!);
      const headHipDist = hipM.y - nose.y; // 正值表示头在臀部上方
      const bodyHeight = Math.abs(hipM.y - (leftAnkle?.y || rightAnkle?.y || hipM.y));
      headHipRatio = bodyHeight > 0 ? headHipDist / bodyHeight : 0;
    }

    // 4. 计算帧间速度
    let velocity = 0;
    if (this.previousPose && this.previousTimestamp) {
      const dt = (now - this.previousTimestamp) / 1000; // 秒
      if (dt > 0 && dt < 2) {
        const prevKps = this.previousPose.keypoints;
        let totalDisplacement = 0;
        let count = 0;
        for (let i = 0; i < Math.min(keypoints.length, prevKps.length); i++) {
          if (keypoints[i].score >= MIN_KEYPOINT_SCORE && prevKps[i].score >= MIN_KEYPOINT_SCORE) {
            const dx = keypoints[i].x - prevKps[i].x;
            const dy = keypoints[i].y - prevKps[i].y;
            totalDisplacement += Math.sqrt(dx * dx + dy * dy);
            count++;
          }
        }
        velocity = count > 0 ? (totalDisplacement / count) / dt : 0;
        // 归一化速度（假设画面宽度为1）
        velocity = Math.min(velocity / 100, 1);
      }
    }

    // 5. 综合判断逻辑
    let fallScore = 0;
    const factors: string[] = [];

    // 躯干角度判断
    if (torsoAngle > FALL_ANGLE_THRESHOLD) {
      fallScore += 0.35;
      factors.push(`躯干倾斜${torsoAngle.toFixed(0)}°`);
    }

    // 宽高比判断
    if (aspectRatio > ASPECT_RATIO_THRESHOLD) {
      fallScore += 0.25;
      factors.push(`宽高比${aspectRatio.toFixed(2)}`);
    }

    // 头臀位置判断
    if (headHipRatio < HEAD_HIP_RATIO_THRESHOLD && headHipRatio !== 0) {
      fallScore += 0.25;
      factors.push('头部低于臀部');
    }

    // 速度判断
    if (velocity > VELOCITY_THRESHOLD) {
      fallScore += 0.15;
      factors.push(`快速移动v=${velocity.toFixed(2)}`);
    }

    // 连续帧确认
    const rawFall = fallScore >= 0.5;
    if (rawFall) {
      this.fallFrameCount++;
    } else {
      this.fallFrameCount = Math.max(0, this.fallFrameCount - 1);
    }

    const isFall = this.fallFrameCount >= this.FALL_CONFIRM_FRAMES;

    // 确定状态
    let state: FallDetectionResult['state'] = 'standing';
    if (isFall) {
      state = 'fallen';
    } else if (rawFall && this.fallFrameCount > 0) {
      state = 'falling';
    } else if (essentialPoints.length < 4) {
      state = 'unknown';
    }

    // 保存当前帧用于下一帧比较
    this.previousPose = pose;
    this.previousTimestamp = now;

    return {
      isFall,
      confidence: Math.min(fallScore, 1),
      angle: torsoAngle,
      aspectRatio,
      headHipRatio,
      velocity,
      state,
      details: factors.length > 0 ? factors.join('；') : '正常站立',
    };
  }

  /**
   * 重置检测器状态
   */
  reset(): void {
    this.previousPose = null;
    this.previousTimestamp = 0;
    this.fallFrameCount = 0;
  }
}
