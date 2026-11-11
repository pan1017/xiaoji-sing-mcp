
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// ==========================================
// 角色与海绵音乐克隆音色的对应关系
// 使用数字 voice_id，不使用 prompt_vid / preview_vid
// ==========================================

const VOICE_MAP: Record<string, string> = {
  graves: "9369650157314",
  krueger: "9359557326850",
};

// ==========================================
// 海绵音乐接口请求
// ==========================================

async function haimianRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
) {
  const cookie = process.env.HAIMIAN_COOKIE;

  if (!cookie) {
    throw new Error(
      "缺少 HAIMIAN_COOKIE 环境变量，请检查 Vercel 配置。"
    );
  }

  const response = await fetch(
    `https://www.haimian.com${path}`,
    {
      method,
      headers: {
        "Cookie": cookie,
        "Content-Type": "application/json",
        "Origin": "https://www.haimian.com",
        "Referer": "https://www.haimian.com/create",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `海绵音乐接口请求失败，HTTP ${response.status}：${responseText.slice(0, 1000)}`
    );
  }

  let result: any;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `海绵音乐返回的不是有效 JSON：${responseText.slice(0, 1000)}`
    );
  }

  // 检查海绵音乐业务状态码
  if (
    typeof result?.status_code === "number" &&
    result.status_code !== 0
  ) {
    const message =
      result?.status_info?.status_msg ||
      "海绵音乐返回业务异常";

    throw new Error(
      `海绵音乐业务错误：${message}；状态码：${result.status_code}；log_id：${result?.status_info?.log_id || result?.log_id || "无"}`
    );
  }

  return result;
}

// ==========================================
// MCP 工具统一错误返回
// ==========================================

function errorResult(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "发生未知错误";

  return {
    content: [
      {
        type: "text" as const,
        text: `操作失败：${message}`,
      },
    ],
    isError: true,
  };
}

// ==========================================
// 注册 MCP 工具
// ==========================================

const handler = createMcpHandler((server) => {

  // ----------------------------------------
  // 1. 测试 MCP 连接
  // ----------------------------------------

  server.registerTool(
    "test_connection",
    {
      title: "测试唱歌服务连接",
      description:
        "测试小手机与唱歌 MCP 服务的连接。",
      inputSchema: z.object({
        message: z.string().optional(),
      }),
    },
    async ({ message }) => ({
      content: [{
        type: "text",
        text:
          "小机唱歌服务连接成功！\n收到消息：" +
          (message || "无"),
      }],
    })
  );

  // ----------------------------------------
  // 2. 查询我的音色
  // ----------------------------------------

  server.registerTool(
    "list_my_voices",
    {
      title: "查询我的音色",
      description:
        "查询用户在海绵音乐中已有的音色，获取可用于歌曲生成的 voice_id。",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await haimianRequest(
          "/jd/api/v1/generate/me/voices"
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ----------------------------------------
  // 3. 查询已经上传的原曲
  // ----------------------------------------

  server.registerTool(
    "list_uploaded_songs",
    {
      title: "查询已上传原曲",
      description:
        "查询用户在海绵音乐中上传的原曲，获取翻唱任务需要的 item_id。",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const result = await haimianRequest(
          "/jd/api/v1/generate/import_music/list?page_num=1&page_size=20"
        );

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ----------------------------------------
  // 4. 提交歌曲生成任务
  // 当前只启用已经抓包验证的原创模式
  // ----------------------------------------

  server.registerTool(
    "start_song_generation",
    {
      title: "开始生成原创歌曲",
      description:
        "调用海绵音乐生成原创歌曲。目前使用已经通过网页抓包验证的原创请求参数。" +
        "如果当前对话角色是 Graves，必须传入 character='graves'；" +
        "如果当前对话角色是 Krueger，必须传入 character='krueger'。" +
        "服务端会自动匹配对应的数字 voice_id。" +
        "prompt 用于描述歌曲风格、曲风和演唱要求。" +
        "当前版本只支持已验证的原创歌曲请求，不支持翻唱参数。" +
        "提交成功后返回任务 ID，后续使用 check_song_status 查询进度。",
      inputSchema: z.object({
        prompt: z.string().min(1).describe(
          "歌曲风格和演唱要求，例如：国风，民谣，温柔男声"
        ),

        character: z.enum([
          "graves",
          "krueger",
        ]).optional().describe(
          "当前演唱角色。Graves 填 graves，Krueger 填 krueger"
        ),

        voice_id: z.string().min(1).optional().describe(
          "手动指定数字音色 ID。仅在不使用 Graves 或 Krueger 角色映射时填写"
        ),
      }),
    },

    async ({
      prompt,
      character,
      voice_id,
    }) => {
      try {

        // 优先使用角色映射；
        // 没有角色时使用手动指定的数字 voice_id
        const selectedVoiceId = character
          ? VOICE_MAP[character]
          : voice_id;

        if (!selectedVoiceId) {
          return {
            content: [{
              type: "text",
              text:
                "缺少音色信息。请指定 character 为 graves 或 krueger，" +
                "或者手动提供数字 voice_id。",
            }],
            isError: true,
          };
        }

        // 严格按照网页端成功请求构造原创请求体
        // 不添加 title、lyrics、genre、source_item 等字段
        const requestBody: Record<string, unknown> = {
          prompt,
          is_original_prompt: true,
          voice_id: Number(selectedVoiceId),
          task_type: 1,
          biz_type: 0,
          batch_size: 2,
        };

        const result: any = await haimianRequest(
          "/jd/api/v1/generate/music",
          "POST",
          requestBody
        );

        // 兼容不同的任务 ID 返回结构
        const taskId =
          result?.data?.task_id ??
          result?.data?.taskId ??
          result?.task_id ??
          result?.taskId;

        if (!taskId) {
          return {
            content: [{
              type: "text",
              text:
                "海绵音乐没有返回可识别的任务 ID。\n" +
                "接口响应：" +
                JSON.stringify(result, null, 2),
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text",
            text:
              "原创歌曲生成任务已提交。\n" +
              `演唱角色：${character || "手动指定音色"}\n` +
              `使用数字音色 ID：${selectedVoiceId}\n` +
              `任务 ID：${taskId}\n` +
              "请保存任务 ID，稍后调用 check_song_status 查询进度。",
          }],
        };

      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ----------------------------------------
  // 5. 查询歌曲生成进度
  // ----------------------------------------

  server.registerTool(
    "check_song_status",
    {
      title: "查询歌曲生成进度",
      description:
        "根据任务 ID 查询海绵音乐歌曲生成进度。" +
        "任务状态为 0 表示排队中，1 表示生成中，" +
        "2 且进度为 100 表示完成，3 表示失败。",
      inputSchema: z.object({
        task_id: z.string().min(1).describe(
          "歌曲生成任务 ID"
        ),
      }),
    },
    async ({ task_id }) => {
      try {
        const result: any = await haimianRequest(
          `/jd/api/v1/generate/task/${encodeURIComponent(task_id)}`
        );

        let payload = result?.data?.payload;

        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            // 解析失败时保留原始 payload
          }
        }

        const status =
          result?.data?.status ??
          result?.status ??
          payload?.status;

        const progress =
          payload?.progress ??
          result?.data?.progress ??
          result?.progress;

        const modelVersion =
          payload?.model_version ??
          result?.data?.model_version;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              task_id,
              status,
              progress,
              model_version: modelVersion,
              detail: payload ?? result?.data ?? result,
            }, null, 2),
          }],
        };

      } catch (error) {
        return errorResult(error);
      }
    }
  );

});

// ==========================================
// 保留 MCP 访问令牌鉴权
// ==========================================

async function authorizedHandler(request: Request) {
  const expectedToken = process.env.MCP_ACCESS_TOKEN;

  if (!expectedToken) {
    return new Response(
      "Server configuration error: MCP_ACCESS_TOKEN is missing.",
      { status: 503 }
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (authorization !== `Bearer ${expectedToken}`) {
    return new Response(
      "Unauthorized",
      { status: 401 }
    );
  }

  return handler(request);
}

// ==========================================
// 导出 GET / POST
// ==========================================

export {
  authorizedHandler as GET,
  authorizedHandler as POST,
};
