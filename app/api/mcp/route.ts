
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// ==========================================
// 角色与海绵音乐克隆音色的对应关系
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
        Cookie: cookie,
        "Content-Type": "application/json",
        Origin: "https://www.haimian.com",
        Referer: "https://www.haimian.com/create",
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
        "查询用户在海绵音乐中上传的原曲，获取翻唱任务需要的素材 ID。",
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
  // 当前使用已验证的原创请求参数
  // ----------------------------------------

  server.registerTool(
    "start_song_generation",
    {
      title: "开始生成原创歌曲",
      description:
        "调用海绵音乐生成原创歌曲。" +
        "如果当前对话角色是 Graves，传入 character='graves'；" +
        "如果当前对话角色是 Krueger，传入 character='krueger'。" +
        "服务端会自动匹配对应的数字 voice_id。" +
        "prompt 用于描述歌曲风格和演唱要求。" +
        "当前版本支持已验证的原创歌曲请求。" +
        "提交成功后返回任务 ID，可调用 check_song_status 查询进度。",
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

        // 严格保留已经验证成功的原创请求参数
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

        const tasks = Array.isArray(result?.data?.tasks)
          ? result.data.tasks
          : [];

        const normalizedTasks = tasks.length > 0
          ? tasks
          : (() => {
              const oldTaskId =
                result?.data?.task_id ??
                result?.data?.taskId ??
                result?.task_id ??
                result?.taskId;

              return oldTaskId
                ? [{ task_id: oldTaskId }]
                : [];
            })();

        if (normalizedTasks.length === 0) {
          return {
            content: [{
              type: "text",
              text:
                "海绵音乐已返回成功状态，但没有找到任务 ID。\n" +
                "接口响应：" +
                JSON.stringify(result, null, 2),
            }],
            isError: true,
          };
        }

        const taskDetails = normalizedTasks.map(
          (task: any, index: number) => ({
            index: index + 1,
            task_id: task.task_id,
            song_id: task.song_id ?? null,
            batch_id: task.batch_id ?? null,
          })
        );

        const taskText = taskDetails
          .map((task: any) =>
            `第 ${task.index} 首：\n` +
            `任务 ID：${task.task_id}\n` +
            `歌曲 ID：${task.song_id ?? "暂无"}`
          )
          .join("\n\n");

        return {
          content: [{
            type: "text",
            text:
              "歌曲生成任务已成功提交！\n\n" +
              `演唱角色：${character || "手动指定音色"}\n` +
              `使用数字音色 ID：${selectedVoiceId}\n` +
              `成功创建任务数：${taskDetails.length}\n\n` +
              taskText +
              "\n\n请保存任务 ID，稍后调用 check_song_status 查询歌曲进度。",
          }],
        };

      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ----------------------------------------
  // 5. 提交歌曲翻唱任务
  // 使用已经抓包验证成功的请求参数
  // ----------------------------------------

  server.registerTool(
    "start_song_cover",
    {
      title: "开始翻唱歌曲",
      description:
        "使用海绵音乐中已经上传的原曲素材进行翻唱。" +
        "需要提供原曲素材 item_id、歌词和风格描述。" +
        "Graves 角色传入 character='graves'；" +
        "Krueger 角色传入 character='krueger'。" +
        "服务端自动匹配对应数字 voice_id。" +
        "提交成功后返回 task_id，可调用 check_song_status 查询进度。",
      inputSchema: z.object({
        source_item_id: z.string().min(1).describe(
          "海绵音乐已上传原曲素材的 item_id"
        ),

        lyrics: z.string().min(1).describe(
          "歌曲歌词，按段落换行"
        ),

        prompt: z.string().min(1).default(
          "严格参考原曲进行翻唱"
        ).describe(
          "演唱风格和要求"
        ),

        character: z.enum([
          "graves",
          "krueger",
        ]).describe(
          "演唱角色：Graves 或 Krueger"
        ),
      }),
    },

    async ({
      source_item_id,
      lyrics,
      prompt,
      character,
    }) => {
      try {
        const selectedVoiceId = VOICE_MAP[character];

        // 严格按照网页端已经成功的翻唱请求构造请求体
        const requestBody: Record<string, unknown> = {
          prompt,
          lyrics,
          is_original_prompt: true,
          voice_id: Number(selectedVoiceId),
          task_type: 1,
          source_item: [
            {
              item: {
                item_id: source_item_id,
                item_type: 0,
              },
            },
          ],
          biz_type: 7,
          batch_size: 1,
        };

        const result: any = await haimianRequest(
          "/jd/api/v1/generate/music",
          "POST",
          requestBody
        );

        const tasks = Array.isArray(result?.data?.tasks)
          ? result.data.tasks
          : [];

        if (tasks.length === 0 || !tasks[0]?.task_id) {
          return {
            content: [{
              type: "text",
              text:
                "翻唱请求已返回，但没有找到任务 ID。\n" +
                JSON.stringify(result, null, 2),
            }],
            isError: true,
          };
        }

        const taskText = tasks.map(
          (task: any, index: number) =>
            `第 ${index + 1} 首：\n` +
            `任务 ID：${task.task_id}\n` +
            `歌曲 ID：${task.song_id ?? "暂无"}\n` +
            `批次 ID：${task.batch_id ?? "暂无"}`
        ).join("\n\n");

        return {
          content: [{
            type: "text",
            text:
              "翻唱任务已成功提交！\n\n" +
              `演唱角色：${character}\n` +
              `音色 ID：${selectedVoiceId}\n` +
              `原曲素材 ID：${source_item_id}\n\n` +
              taskText +
              "\n\n请稍后调用 check_song_status 查询生成进度。",
          }],
        };

      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // ----------------------------------------
  // 6. 查询歌曲生成进度
  // ----------------------------------------

server.registerTool(
  "search_netease_song",
  {
    title: "搜索网易云歌曲",
    description:
      "根据歌曲名称和歌手名称搜索网易云音乐，返回歌曲ID、歌名、歌手、专辑和时长。优先核对歌曲名称和歌手，排除伴奏及明显不匹配的结果。",
    inputSchema: {
      song_name: z.string().min(1).describe("歌曲名称"),
      artist_name: z.string().min(1).describe("歌手名称"),
    },
  },
  async ({ song_name, artist_name }) => {
    try {
      const keyword = `${song_name} ${artist_name}`;

      const url =
        "https://music.163.com/api/search/get/?" +
        new URLSearchParams({
          s: keyword,
          type: "1",
          limit: "10",
          offset: "0",
        }).toString();

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://music.163.com/",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(
          `网易云搜索请求失败，HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (result.code !== 200) {
        throw new Error(
          `网易云返回异常状态：${result.code}`
        );
      }

      const songs = result.result?.songs ?? [];

      if (songs.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "没有搜索到相关歌曲，请检查歌名和歌手名称。",
            },
          ],
        };
      }

      const normalize = (value: string) =>
        value.toLowerCase().replace(/\s+/g, "").trim();

      const targetSong = normalize(song_name);
      const targetArtist = normalize(artist_name);

      const candidates = songs.map((song: any) => {
        const artists = (song.artists ?? []).map(
          (artist: any) => artist.name
        );

        const songTitle = normalize(song.name);
        const artistNames = artists.map(normalize);

        const exactTitle = songTitle === targetSong;
        const exactArtist = artistNames.includes(targetArtist);

        const isInstrumental =
          song.name.includes("伴奏") ||
          song.name.includes("纯音乐");

        return {
          song_id: song.id,
          song_name: song.name,
          artists,
          album: song.album?.name ?? "",
          duration_ms: song.duration ?? 0,
          duration:
            `${Math.floor((song.duration ?? 0) / 60000)}分` +
            `${Math.floor(((song.duration ?? 0) % 60000) / 1000)}秒`,
          exact_title: exactTitle,
          exact_artist: exactArtist,
          instrumental: isInstrumental,
          matched:
            exactTitle && exactArtist && !isInstrumental,
        };
      });

      candidates.sort((a: any, b: any) => {
        return Number(b.matched) - Number(a.matched);
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                search_keyword: keyword,
                total: candidates.length,
                best_match:
                  candidates.find((song: any) => song.matched) ??
                  null,
                songs: candidates,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `网易云歌曲搜索失败：${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);


server.registerTool(
  "get_netease_song_info",
  {
    title: "获取网易云歌曲信息",
    description:
      "根据网易云歌曲ID获取歌曲详情、歌词和音频地址，供后续有授权的素材处理流程使用。",
    inputSchema: {
      song_id: z.string().min(1).describe("网易云歌曲ID"),
    },
  },
  async ({ song_id }) => {
    try {
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://music.163.com/",
      };

      const [detailResponse, lyricResponse] =
        await Promise.all([
          fetch(
            `https://music.163.com/api/song/detail/?id=${encodeURIComponent(song_id)}&ids=%5B${encodeURIComponent(song_id)}%5D`,
            { headers, signal: AbortSignal.timeout(15000) }
          ),
          fetch(
            `https://music.163.com/api/song/lyric?id=${encodeURIComponent(song_id)}&lv=1&tv=1`,
            { headers, signal: AbortSignal.timeout(15000) }
          ),
        ]);

      if (!detailResponse.ok || !lyricResponse.ok) {
        throw new Error("网易云歌曲信息请求失败");
      }

      const [detail, lyricData] = await Promise.all([
        detailResponse.json(),
        lyricResponse.json(),
      ]);

      const song =
        detail.songs?.[0] ??
        detail.songs?.songs?.[0] ??
        null;

      if (!song) {
        throw new Error("没有获取到歌曲详情，请检查歌曲ID");
      }

      const lyric = lyricData.lrc?.lyric ?? "";
      const artists = (song.artists ?? song.ar ?? []).map(
        (artist: any) => artist.name
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                song: {
                  song_id: String(song.id),
                  name: song.name,
                  artists,
                  album: song.album?.name ?? song.al?.name ?? "",
                  duration_ms: song.duration ?? song.dt ?? 0,
                  duration_seconds: Math.floor(
                    (song.duration ?? song.dt ?? 0) / 1000
                  ),
                },
                lyrics_available: Boolean(lyric),
                lyrics: lyric,
                audio_url:
                  `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(song_id)}.mp3`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `获取网易云歌曲信息失败：${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);



  
server.registerTool(
  "check_netease_audio",
  {
    title: "检查网易云音频",
    description:
      "检查指定网易云歌曲的音频地址是否可访问，并检查歌曲时长和音频响应信息。仅用于有权使用的音源。",
    inputSchema: {
      song_id: z.string().min(1).describe("网易云歌曲ID"),
    },
  },
  async ({ song_id }) => {
    try {
      const detailUrl =
        `https://music.163.com/api/song/detail/?id=${encodeURIComponent(song_id)}&ids=%5B${encodeURIComponent(song_id)}%5D`;

      const detailResponse = await fetch(detailUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://music.163.com/",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!detailResponse.ok) {
        throw new Error("无法获取歌曲详情");
      }

      const detail = await detailResponse.json();
      const song = detail.songs?.[0];

      if (!song) {
        throw new Error("没有找到对应歌曲");
      }

      const durationMs = song.duration ?? song.dt ?? 0;
      const durationSeconds = Math.floor(durationMs / 1000);

      const audioUrl =
        `https://music.163.com/song/media/outer/url?id=${encodeURIComponent(song_id)}.mp3`;

      const audioResponse = await fetch(audioUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://music.163.com/",
        },
        signal: AbortSignal.timeout(20000),
      });

      const contentLength = Number(
        audioResponse.headers.get("content-length") ?? 0
      );

      const contentType =
        audioResponse.headers.get("content-type") ?? "unknown";

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                song_name: song.name,
                artists: (song.artists ?? song.ar ?? []).map(
                  (artist: any) => artist.name
                ),
                duration_seconds: durationSeconds,
                duration_minutes: Number(
                  (durationSeconds / 60).toFixed(2)
                ),
                audio_accessible: audioResponse.ok,
                http_status: audioResponse.status,
                content_type: contentType,
                file_size_bytes: contentLength || null,
                file_size_mb: contentLength
                  ? Number(
                      (contentLength / 1024 / 1024).toFixed(2)
                    )
                  : null,
                duration_under_5_minutes:
                  durationSeconds <= 300,
                note:
                  "HEAD 请求结果仅用于初步检查，不能保证实际下载或上传一定成功。请确保拥有音源使用授权。",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `音频检查失败：${
              error instanceof Error
                ? error.message
                : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

  
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
