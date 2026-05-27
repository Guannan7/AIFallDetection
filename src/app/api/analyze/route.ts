import { NextRequest, NextResponse } from 'next/server';

const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'fall-detection-ai-analyzer' });
}

function buildSystemPrompt() {
  return `你是一个专业的跌倒检测AI分析助手。根据人体姿态关键点数据和/或画面图像，分析当前人体状态是否为跌倒。
你需要综合考虑以下因素：
1. 躯干倾斜角度（正常站立约0-15°，跌倒通常>45°）
2. 身体宽高比（站立时高度>宽度，跌倒时宽度接近或大于高度）
3. 头部相对臀部的位置关系
4. 帧间位移速度
5. 关键点置信度
6. 画面中人体的实际姿态（如有图像）

请以结构化格式回复，包含以下内容：
- 是否跌倒（是/否/疑似）
- 置信度（0-100%）
- 详细分析说明
- 处理建议`;
}

export async function POST(request: NextRequest) {
  try {
    const { poseData, imageData, mode } = await request.json();

    if (!poseData && !imageData) {
      return NextResponse.json(
        { error: '缺少姿态数据或图像数据' },
        { status: 400 }
      );
    }

    const modeLabel = mode === 'camera' ? '摄像头实时' : mode === 'video' ? '视频' : '图片';
    const systemPrompt = buildSystemPrompt();

    // 有图像数据时使用通义千问 VL（支持视觉理解）
    // 无图像数据时使用 DeepSeek（纯文本分析）
    const hasImage = !!imageData;

    if (hasImage) {
      const qwenApiKey = process.env.QWEN_API_KEY;
      if (!qwenApiKey) {
        return NextResponse.json(
          { error: '通义千问 API Key 未配置，无法进行图像识别分析' },
          { status: 500 }
        );
      }

      // 构建多模态消息：图像 + 文本
      const userContent: Array<
        | { type: 'image_url'; image_url: { url: string } }
        | { type: 'text'; text: string }
      > = [
        {
          type: 'image_url',
          image_url: { url: imageData },
        },
        {
          type: 'text',
          text: `请分析以下${modeLabel}画面中的人体姿态，判断是否发生跌倒。${poseData ? `\n\n姿态关键点数据：${JSON.stringify(poseData, null, 2)}` : ''}`,
        },
      ];

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ];

      const response = await fetch(QWEN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${qwenApiKey}`,
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          messages,
          temperature: 0.3,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('通义千问 API 错误:', response.status, errorText);
        return NextResponse.json(
          { error: `通义千问 API 调用失败: ${response.status}` },
          { status: response.status }
        );
      }

      return createStreamResponse(response);
    } else {
      // 纯文本分析 → 使用 DeepSeek
      const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
      if (!deepseekApiKey) {
        return NextResponse.json(
          { error: 'DeepSeek API Key 未配置' },
          { status: 500 }
        );
      }

      const userContent = `请分析以下${modeLabel}画面中的人体姿态数据，判断是否发生跌倒：\n\n姿态数据：${JSON.stringify(poseData, null, 2)}`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ];

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.3,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API 错误:', response.status, errorText);
        return NextResponse.json(
          { error: `DeepSeek API 调用失败: ${response.status}` },
          { status: response.status }
        );
      }

      return createStreamResponse(response);
    }
  } catch (error) {
    console.error('AI分析失败:', error);
    return NextResponse.json(
      { error: 'AI增强分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}

function createStreamResponse(upstream: Response) {
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (error) {
        console.error('流式传输错误:', error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
