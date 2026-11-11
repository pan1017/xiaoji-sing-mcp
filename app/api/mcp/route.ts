
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// 海绵音乐接口请求
async function haimianRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
) {
  const cookie = process.env.HAIMIAN_COOKIE;

  if (!cookie) {
    throw new Error("缺少 HAIMIAN_COOKIE 环境变量，请检查 Vercel 配置。");
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

  if (!response.ok) {
    throw new Error(
      `海绵音乐接口请求失败，HTTP ${response.status}`
    );
  }

  return await response.json();
}

// MCP 工具统一错误返回
function errorResult(error: unknown) {
  const message =
    error instanceof Error ? error.message : "发生未知错误";

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

const handler = createMcpHandler((server) => {

  // 1. 测试 MCP 连接
  server.registerTool(
    "test_connection",
    {
      title: "测试唱歌服务连接",
      description: "测试小手机与唱歌 MCP 服务的连接。",
      inputSchema: z.object({
        message: z.string().optional(),
      }),
    },
    async ({ message }) => ({
      content: [{
        type: "text",
        text: "小机唱歌服务连接成功！\n收到消息：" +
          (message || "无"),
      }],
    })
  );

  // 2. 查询我的音色
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

  // 3. 查询已经上传的原曲
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

  // 4. 提交歌曲生成任务
  server.registerTool(
    "start_song_generation",
    {
      title: "开始生成歌曲",
      description:
        "根据用户提供的歌词、风格和音色，在海绵音乐中提交歌曲生成任务。用户拥有原曲使用权并提供已上传原曲的 item_id 时，可进行翻唱；否则按原创歌曲方式提交。返回任务 ID，生成过程在后台进行。",
      inputSchema: z.object({
        title: z.string().min(1).describe("歌曲标题"),
        prompt: z.string().min(1).describe("歌曲风格和演唱要求"),
        lyrics: z.string().min(1).describe("用户有权使用的歌词"),
        voice_id: z.string().min(1).describe("音色 ID"),
        source_item_id: z.string().optional().describe(
          "翻唱时使用的已上传原曲 item_id；原创歌曲不填写"
        ),
        genre: z.string().optional().describe(
          "原创歌曲的音乐类型，例如 Folk、Pop"
        ),
      }),
    },
    async ({
      title,
      prompt,
      lyrics,
      voice_id,
      source_item_id,
      genre,
    }) => {
      try {
        const requestBody: Record<string, unknown> = {
          title,
          prompt,
          lyrics,
          is_original_prompt: false,
          voice_id,
          task_type: 1,
          biz_type: 7,
          batch_size: 1,
        };

        if (source_item_id) {
          requestBody.source_item = [
            {
              item: {
                item_id: source_item_id,
                item_type: 4,
              },
            },
          ];
        } else if (genre) {
          requestBody.genre = genre;
        }

        const result: any = await haimianRequest(
          "/jd/api/v1/generate/music",
          "POST",
          requestBody
        );

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
                "请求已返回，但没有识别到任务 ID。接口响应：" +
                JSON.stringify(result),
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text:
              "歌曲生成任务已提交。\n" +
              `歌曲名称：${title}\n` +
              `任务 ID：${taskId}\n` +
              "请保存任务 ID，稍后调用 check_song_status 查询进度。",
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 5. 查询歌曲生成进度
  server.registerTool(
    "check_song_status",
    {
      title: "查询歌曲生成进度",
      description:
        "根据任务 ID 查询海绵音乐歌曲生成进度。任务状态为 0 表示排队中，1 表示生成中，2 且进度为 100 表示完成，3 表示失败。",
      inputSchema: z.object({
        task_id: z.string().min(1).describe("歌曲生成任务 ID"),
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
            // 保留原始 payload
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

// 保留 MCP 访问令牌鉴权
async function authorizedHandler(request: Request) {
  const expectedToken = process.env.MCP_ACCESS_TOKEN;

  if (!expectedToken) {
    return new Response(
      "Server configuration error: MCP_ACCESS_TOKEN is missing.",
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${expectedToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handler(request);
}

export {
  authorizedHandler as GET,
  authorizedHandler as POST,
};
