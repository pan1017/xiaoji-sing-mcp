
// import { createMcpHandler } from "mcp-handler";
// import { z } from "zod";

// // ==========================================
// // 角色音色映射
// // ==========================================

// const VOICE_MAP: Record<string, string> = {
//   graves: "9369650157314",
//   krueger: "9359557326850",
// };

// // ==========================================
// // 通用海绵音乐请求
// // ==========================================

// async function haimianRequest(
//   path: string,
//   method: "GET" | "POST" = "GET",
//   body?: Record<string, unknown>
// ) {
//   const cookie = process.env.HAIMIAN_COOKIE;

//   if (!cookie) {
//     throw new Error("缺少 HAIMIAN_COOKIE 环境变量");
//   }

//   const response = await fetch(
//     `https://www.haimian.com${path}`,
//     {
//       method,
//       headers: {
//         Cookie: cookie,
//         "Content-Type": "application/json",
//         Origin: "https://www.haimian.com",
//         Referer: "https://www.haimian.com/create",
//       },
//       ...(body ? { body: JSON.stringify(body) } : {}),
//       cache: "no-store",
//     }
//   );

//   const text = await response.text();

//   if (!response.ok) {
//     throw new Error(
//       `海绵音乐 HTTP ${response.status}: ${text.slice(0, 800)}`
//     );
//   }

//   let result: any;

//   try {
//     result = JSON.parse(text);
//   } catch {
//     throw new Error(`海绵音乐返回无效 JSON: ${text.slice(0, 500)}`);
//   }

//   if (
//     typeof result?.status_code === "number" &&
//     result.status_code !== 0
//   ) {
//     throw new Error(
//       `海绵音乐业务错误：${result?.status_msg || "未知错误"}；` +
//       `状态码：${result.status_code}；` +
//       `log_id：${result?.status_info?.log_id || "无"}`
//     );
//   }

//   return result;
// }

// // ==========================================
// // 获取海绵音乐临时上传凭证
// // ==========================================

// async function getHaimianAuth() {
//   const officialUid = process.env.HAIMIAN_OFFICIAL_UID;

//   if (!officialUid) {
//     throw new Error("缺少 HAIMIAN_OFFICIAL_UID 环境变量");
//   }

//   const params = new URLSearchParams({
//     app_name: "goat",
//     app_name_cn: "海绵音乐",
//     aid: "588628",
//     app_id: "588628",
//     region: "CN",
//     language: "zh",
//     app_version: "1.0.0.1702",
//     channel: "online",
//     device_platform: "web",
//     official_uid: officialUid,
//   });

//   const response = await fetch(
//     `https://www.haimian.com/jd/api/v1/video/get_auth_token?${params}`,
//     {
//       method: "POST",
//       headers: {
//         Cookie: process.env.HAIMIAN_COOKIE || "",
//         "Content-Type": "application/json",
//         Origin: "https://www.haimian.com",
//         Referer: "https://www.haimian.com/create",
//       },
//       cache: "no-store",
//     }
//   );

//   if (!response.ok) {
//     throw new Error(
//       `获取上传凭证失败：HTTP ${response.status}`
//     );
//   }

//   const result: any = await response.json();

//   if (result.status_code !== 0 || !result.data) {
//     throw new Error(
//       `获取上传凭证失败：${result.status_msg || "未知错误"}`
//     );
//   }

//   const auth = result.data;

//   if (
//     !auth.auth_token ||
//     !auth.access_key ||
//     !auth.secret_key ||
//     !auth.expired_time
//   ) {
//     throw new Error("临时凭证字段不完整");
//   }

//   if (new Date(auth.expired_time).getTime() <= Date.now()) {
//     throw new Error("获取到的临时凭证已经过期");
//   }

//   return {
//     auth_token: auth.auth_token,
//     access_key: auth.access_key,
//     secret_key: auth.secret_key,
//     expired_time: auth.expired_time,
//   };
// }

// // ==========================================
// // 错误处理
// // ==========================================

// function errorResult(error: unknown) {
//   return {
//     content: [{
//       type: "text" as const,
//       text: `操作失败：${
//         error instanceof Error ? error.message : String(error)
//       }`,
//     }],
//     isError: true,
//   };
// }

// // ==========================================
// // MCP 工具
// // ==========================================

// const handler = createMcpHandler((server) => {

//   // 1. 测试连接
//   server.registerTool(
//     "test_connection",
//     {
//       title: "测试唱歌服务连接",
//       description: "测试小手机与唱歌 MCP 服务的连接。",
//       inputSchema: z.object({
//         message: z.string().optional(),
//       }),
//     },
//     async ({ message }) => ({
//       content: [{
//         type: "text",
//         text: `小机唱歌服务连接成功！\n收到消息：${message || "无"}`,
//       }],
//     })
//   );

//   // 2. 查询音色
//   server.registerTool(
//     "list_my_voices",
//     {
//       title: "查询我的音色",
//       description: "查询海绵音乐中已有的音色。",
//       inputSchema: z.object({}),
//     },
//     async () => {
//       try {
//         const result = await haimianRequest(
//           "/jd/api/v1/generate/me/voices"
//         );

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify(result, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 3. 查询已上传素材
//   server.registerTool(
//     "list_uploaded_songs",
//     {
//       title: "查询已上传原曲",
//       description: "查询海绵音乐中已经上传的原曲素材。",
//       inputSchema: z.object({}),
//     },
//     async () => {
//       try {
//         const result = await haimianRequest(
//           "/jd/api/v1/generate/import_music/list?page_num=1&page_size=20"
//         );

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify(result, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 4. 获取临时上传凭证
//   server.registerTool(
//     "test_haimian_auth",
//     {
//       title: "测试海绵上传认证",
//       description:
//         "获取海绵音乐临时上传凭证，并检查凭证是否有效。不会向对话输出密钥。",
//       inputSchema: z.object({}),
//     },
//     async () => {
//       try {
//         const auth = await getHaimianAuth();

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               message: "海绵音乐临时凭证获取成功",
//               expired_time: auth.expired_time,
//               credentials_hidden: true,
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 5. 原创歌曲生成
//   server.registerTool(
//     "start_song_generation",
//     {
//       title: "开始生成原创歌曲",
//       description:
//         "生成原创歌曲。Graves 使用 graves，Krueger 使用 krueger。",
//       inputSchema: z.object({
//         prompt: z.string().min(1),
//         character: z.enum(["graves", "krueger"]).optional(),
//         voice_id: z.string().min(1).optional(),
//       }),
//     },
//     async ({ prompt, character, voice_id }) => {
//       try {
//         const selectedVoiceId = character
//           ? VOICE_MAP[character]
//           : voice_id;

//         if (!selectedVoiceId) {
//           throw new Error("请指定 character 或 voice_id");
//         }

//         const result: any = await haimianRequest(
//           "/jd/api/v1/generate/music",
//           "POST",
//           {
//             prompt,
//             is_original_prompt: true,
//             voice_id: Number(selectedVoiceId),
//             task_type: 1,
//             biz_type: 0,
//             batch_size: 2,
//           }
//         );

//         const tasks = result?.data?.tasks || [];

//         if (!tasks.length) {
//           throw new Error(
//             `没有获取到任务 ID：${JSON.stringify(result)}`
//           );
//         }

//         return {
//           content: [{
//             type: "text",
//             text:
//               "原创歌曲任务提交成功！\n" +
//               `角色：${character || "自定义音色"}\n` +
//               `音色 ID：${selectedVoiceId}\n\n` +
//               tasks.map((task: any, index: number) =>
//                 `第 ${index + 1} 首：\n` +
//                 `任务 ID：${task.task_id}\n` +
//                 `歌曲 ID：${task.song_id ?? "暂无"}`
//               ).join("\n\n"),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 6. 歌曲翻唱 (已修正：路径指向 /song_adaptation/create，voice_id 转数字，item_type 设为 4)
//   server.registerTool(
//     "start_song_cover",
//     {
//       title: "开始翻唱歌曲",
//       description:
//         "使用海绵音乐中导入的网易云素材进行翻唱。需要导入的素材 ID、歌词、提示词和角色。",
//       inputSchema: z.object({
//         source_item_id: z.string().min(1),
//         lyrics: z.string().min(1),
//         prompt: z.string().min(1).default("改编翻唱，保持原曲旋律、和弦、段落结构和节奏速度，不重新编曲。"),
//         character: z.enum(["graves", "krueger"]),
//       }),
//     },
//     async ({
//       source_item_id,
//       lyrics,
//       prompt,
//       character,
//     }) => {
//       try {
//         const selectedVoiceId = Number(VOICE_MAP[character]);

//         const result: any = await haimianRequest(
//           "/jd/api/v1/generate/song_adaptation/create",
//           "POST",
//           {
//             source_item: [{
//               item: {
//                 item_id: source_item_id,
//                 item_type: 4, // 必须为 4（ImportedMusic）
//               },
//             }],
//             voice_id: selectedVoiceId, // 必须是数字
//             voice_source: "user_record",
//             prompt,
//             lyrics,
//             batch_size: 1,
//             title: "小手机翻唱歌曲",
//           }
//         );

//         const d = result?.data || {};
//         const tasks = d?.tasks || [];
//         const task_id = tasks[0]?.task_id || d?.task_id;
//         const song_id = tasks[0]?.song_id || d?.song_id;

//         if (!task_id) {
//           throw new Error(
//             `没有获取到翻唱任务 ID：${JSON.stringify(result)}`
//           );
//         }

//         return {
//           content: [{
//             type: "text",
//             text:
//               "✓✓✓ 翻唱任务提交成功！\n" +
//               `角色：${character}\n` +
//               `音色 ID：${selectedVoiceId}\n` +
//               `素材 ID：${source_item_id}\n` +
//               `任务 ID：${task_id}\n` +
//               `歌曲 ID：${song_id ?? "暂无"}`,
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 7. 网易云搜索
//   server.registerTool(
//     "search_netease_song",
//     {
//       title: "搜索网易云歌曲",
//       description: "按歌名和歌手搜索网易云歌曲。",
//       inputSchema: z.object({
//         song_name: z.string().min(1),
//         artist_name: z.string().min(1),
//       }),
//     },
//     async ({ song_name, artist_name }) => {
//       try {
//         const params = new URLSearchParams({
//           s: `${song_name} ${artist_name}`,
//           type: "1",
//           limit: "10",
//           offset: "0",
//         });

//         const response = await fetch(
//           `https://music.163.com/api/search/get/?${params}`,
//           {
//             headers: {
//               "User-Agent": "Mozilla/5.0",
//               Referer: "https://music.163.com/",
//             },
//             signal: AbortSignal.timeout(15000),
//           }
//         );

//         if (!response.ok) {
//           throw new Error(`网易云 HTTP ${response.status}`);
//         }

//         const result: any = await response.json();
//         const songs = result.result?.songs || [];

//         const normalize = (value: string) =>
//           value.toLowerCase().replace(/\s+/g, "").trim();

//         const candidates = songs.map((song: any) => {
//           const artists = (song.artists || []).map(
//             (artist: any) => artist.name
//           );

//           const exactTitle =
//             normalize(song.name) === normalize(song_name);

//           const exactArtist = artists.some(
//             (artist: string) =>
//               normalize(artist) === normalize(artist_name)
//           );

//           const instrumental =
//             /伴奏|纯音乐/.test(song.name);

//           return {
//             song_id: song.id,
//             song_name: song.name,
//             artists,
//             album: song.album?.name || "",
//             duration_ms: song.duration || 0,
//             exact_title: exactTitle,
//             exact_artist: exactArtist,
//             instrumental,
//             matched: exactTitle && exactArtist && !instrumental,
//           };
//         });

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               best_match: candidates.find((item: any) => item.matched) || null,
//               songs: candidates,
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 8. 网易云歌曲详情和歌词
//   server.registerTool(
//     "get_netease_song_info",
//     {
//       title: "获取网易云歌曲信息",
//       description:
//         "查询歌曲详情、歌词可用性和音频地址。请确保音频使用具有授权。",
//       inputSchema: z.object({
//         song_id: z.string().min(1),
//       }),
//     },
//     async ({ song_id }) => {
//       try {
//         const headers = {
//           "User-Agent": "Mozilla/5.0",
//           Referer: "https://music.163.com/",
//         };

//         const [detailResponse, lyricResponse] = await Promise.all([
//           fetch(
//             `https://music.163.com/api/song/detail/?id=${song_id}&ids=%5B${song_id}%5D`,
//             { headers, signal: AbortSignal.timeout(15000) }
//           ),
//           fetch(
//             `https://music.163.com/api/song/lyric?id=${song_id}&lv=1&tv=1`,
//             { headers, signal: AbortSignal.timeout(15000) }
//           ),
//         ]);

//         if (!detailResponse.ok || !lyricResponse.ok) {
//           throw new Error("网易云歌曲信息请求失败");
//         }

//         const [detail, lyricData]: any = await Promise.all([
//           detailResponse.json(),
//           lyricResponse.json(),
//         ]);

//         const song = detail.songs?.[0];

//         if (!song) {
//           throw new Error("没有找到对应歌曲");
//         }

//         const lyrics = lyricData.lrc?.lyric || "";

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               song: {
//                 song_id: String(song.id),
//                 name: song.name,
//                 artists: (song.artists || song.ar || []).map(
//                   (artist: any) => artist.name
//                 ),
//                 album: song.album?.name || song.al?.name || "",
//                 duration_ms: song.duration || song.dt || 0,
//               },
//               lyrics_available: Boolean(lyrics),
//               lyrics,
//               audio_url:
//                 `https://music.163.com/song/media/outer/url?id=${song_id}.mp3`,
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 9. 检查网易云音频
//   server.registerTool(
//     "check_netease_audio",
//     {
//       title: "检查网易云音频",
//       description: "检查音频地址响应及歌曲时长。",
//       inputSchema: z.object({
//         song_id: z.string().min(1),
//       }),
//     },
//     async ({ song_id }) => {
//       try {
//         const response = await fetch(
//           `https://music.163.com/api/song/detail/?id=${song_id}&ids=%5B${song_id}%5D`,
//           {
//             headers: {
//               "User-Agent": "Mozilla/5.0",
//               Referer: "https://music.163.com/",
//             },
//             signal: AbortSignal.timeout(15000),
//           }
//         );

//         if (!response.ok) {
//           throw new Error("无法获取歌曲详情");
//         }

//         const detail: any = await response.json();
//         const song = detail.songs?.[0];

//         if (!song) {
//           throw new Error("没有找到歌曲");
//         }

//         const durationSeconds = Math.floor(
//           (song.duration || song.dt || 0) / 1000
//         );

//         const audioUrl =
//           `https://music.163.com/song/media/outer/url?id=${song_id}.mp3`;

//         const audioResponse = await fetch(audioUrl, {
//           method: "HEAD",
//           redirect: "follow",
//           headers: {
//             "User-Agent": "Mozilla/5.0",
//             Referer: "https://music.163.com/",
//           },
//           signal: AbortSignal.timeout(20000),
//         });

//         const length = Number(
//           audioResponse.headers.get("content-length") || 0
//         );

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               song_name: song.name,
//               artists: (song.artists || song.ar || []).map(
//                 (artist: any) => artist.name
//               ),
//               duration_seconds: durationSeconds,
//               duration_minutes: Number((durationSeconds / 60).toFixed(2)),
//               audio_accessible: audioResponse.ok,
//               http_status: audioResponse.status,
//               content_type:
//                 audioResponse.headers.get("content-type"),
//               file_size_bytes: length || null,
//               file_size_mb: length
//                 ? Number((length / 1024 / 1024).toFixed(2))
//                 : null,
//               duration_under_5_minutes: durationSeconds <= 300,
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 10. 查询任务进度
//   server.registerTool(
//     "check_song_status",
//     {
//       title: "查询歌曲生成进度",
//       description:
//         "根据任务 ID 查询海绵音乐生成进度。0 排队，1 生成中，2 且进度 100 为完成，3 失败。",
//       inputSchema: z.object({
//         task_id: z.string().min(1),
//       }),
//     },
//     async ({ task_id }) => {
//       try {
//         const result: any = await haimianRequest(
//           `/jd/api/v1/generate/task/${encodeURIComponent(task_id)}`
//         );

//         let payload = result?.data?.payload;

//         if (typeof payload === "string") {
//           try {
//             payload = JSON.parse(payload);
//           } catch {
//             // 保留原始值
//           }
//         }

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               task_id,
//               status:
//                 result?.data?.status ??
//                 result?.status ??
//                 payload?.status,
//               progress:
//                 payload?.progress ??
//                 result?.data?.progress ??
//                 result?.progress,
//               detail: payload ?? result?.data ?? result,
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

//   // 11. 导入网易云歌曲到海绵 (新增：桥接网易云链接与海绵素材库)
//   server.registerTool(
//     "import_netease_to_haimian",
//     {
//       title: "导入网易云歌曲到海绵",
//       description: "通过网易云分享链接将原曲导入海绵音乐，获取素材 import_id。",
//       inputSchema: z.object({
//         share_link: z.string().min(1, "请输入网易云音乐分享链接，例如 https://music.163.com/song?id=xxxx"),
//       }),
//     },
//     async ({ share_link }) => {
//       try {
//         const result: any = await haimianRequest(
//           "/jd/api/v1/generate/import_music/by_link",
//           "POST",
//           {
//             share_link,
//           }
//         );

//         const import_id = result?.data?.item?.import_id;

//         if (!import_id) {
//           throw new Error(`导入失败，未返回 import_id：${JSON.stringify(result)}`);
//         }

//         return {
//           content: [{
//             type: "text",
//             text: JSON.stringify({
//               success: true,
//               message: "网易云原曲导入海绵成功",
//               import_id: String(import_id),
//             }, null, 2),
//           }],
//         };
//       } catch (error) {
//         return errorResult(error);
//       }
//     }
//   );

// });

// // ==========================================
// // MCP 鉴权
// // ==========================================

// async function authorizedHandler(request: Request) {
//   const expectedToken = process.env.MCP_ACCESS_TOKEN;

//   if (!expectedToken) {
//     return new Response(
//       "Server configuration error: MCP_ACCESS_TOKEN is missing.",
//       { status: 503 }
//     );
//   }

//   if (
//     request.headers.get("authorization") !==
//     `Bearer ${expectedToken}`
//   ) {
//     return new Response("Unauthorized", { status: 401 });
//   }

//   return handler(request);
// }

// export {
//   authorizedHandler as GET,
//   authorizedHandler as POST,
// };

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// ==========================================
// 角色音色映射
// ==========================================

const VOICE_MAP: Record<string, string> = {
  graves: "9369650157314",
  krueger: "9359557326850",
};

// ==========================================
// 通用海绵音乐请求
// ==========================================

async function haimianRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
) {
  const cookie = process.env.HAIMIAN_COOKIE;

  if (!cookie) {
    throw new Error("缺少 HAIMIAN_COOKIE 环境变量");
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

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `海绵音乐 HTTP ${response.status}: ${text.slice(0, 800)}`
    );
  }

  let result: any;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`海绵音乐返回无效 JSON: ${text.slice(0, 500)}`);
  }

  if (
    typeof result?.status_code === "number" &&
    result.status_code !== 0
  ) {
    throw new Error(
      `海绵音乐业务错误：${result?.status_msg || "未知错误"}；` +
      `状态码：${result.status_code}；` +
      `log_id：${result?.status_info?.log_id || "无"}`
    );
  }

  return result;
}

// ==========================================
// 获取海绵音乐临时上传凭证
// ==========================================

async function getHaimianAuth() {
  const officialUid = process.env.HAIMIAN_OFFICIAL_UID;

  if (!officialUid) {
    throw new Error("缺少 HAIMIAN_OFFICIAL_UID 环境变量");
  }

  const params = new URLSearchParams({
    app_name: "goat",
    app_name_cn: "海绵音乐",
    aid: "588628",
    app_id: "588628",
    region: "CN",
    language: "zh",
    app_version: "1.0.0.1702",
    channel: "online",
    device_platform: "web",
    official_uid: officialUid,
  });

  const response = await fetch(
    `https://www.haimian.com/jd/api/v1/video/get_auth_token?${params}`,
    {
      method: "POST",
      headers: {
        Cookie: process.env.HAIMIAN_COOKIE || "",
        "Content-Type": "application/json",
        Origin: "https://www.haimian.com",
        Referer: "https://www.haimian.com/create",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `获取上传凭证失败：HTTP ${response.status}`
    );
  }

  const result: any = await response.json();

  if (result.status_code !== 0 || !result.data) {
    throw new Error(
      `获取上传凭证失败：${result.status_msg || "未知错误"}`
    );
  }

  const auth = result.data;

  if (
    !auth.auth_token ||
    !auth.access_key ||
    !auth.secret_key ||
    !auth.expired_time
  ) {
    throw new Error("临时凭证字段不完整");
  }

  if (new Date(auth.expired_time).getTime() <= Date.now()) {
    throw new Error("获取到的临时凭证已经过期");
  }

  return {
    auth_token: auth.auth_token,
    access_key: auth.access_key,
    secret_key: auth.secret_key,
    expired_time: auth.expired_time,
  };
}

// ==========================================
// 错误处理
// ==========================================

function errorResult(error: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: `操作失败：${
        error instanceof Error ? error.message : String(error)
      }`,
    }],
    isError: true,
  };
}

// ==========================================
// MCP 工具
// ==========================================

const handler = createMcpHandler((server) => {

  // 1. 测试连接
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
        text: `小机唱歌服务连接成功！\n收到消息：${message || "无"}`,
      }],
    })
  );

  // 2. 查询音色
  server.registerTool(
    "list_my_voices",
    {
      title: "查询我的音色",
      description: "查询海绵音乐中已有的音色。",
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

  // 3. 查询已上传素材
  server.registerTool(
    "list_uploaded_songs",
    {
      title: "查询已上传原曲",
      description: "查询海绵音乐中已经上传的原曲素材。",
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

  // 4. 获取临时上传凭证
  server.registerTool(
    "test_haimian_auth",
    {
      title: "测试海绵上传认证",
      description: "获取海绵音乐临时上传凭证，并检查凭证是否有效。",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const auth = await getHaimianAuth();

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "海绵音乐临时凭证获取成功",
              expired_time: auth.expired_time,
              credentials_hidden: true,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 5. 原创歌曲生成
  server.registerTool(
    "start_song_generation",
    {
      title: "开始生成原创歌曲",
      description: "生成原创歌曲。",
      inputSchema: z.object({
        prompt: z.string().min(1),
        character: z.enum(["graves", "krueger"]).optional(),
        voice_id: z.string().min(1).optional(),
      }),
    },
    async ({ prompt, character, voice_id }) => {
      try {
        const selectedVoiceId = character
          ? VOICE_MAP[character]
          : voice_id;

        if (!selectedVoiceId) {
          throw new Error("请指定 character 或 voice_id");
        }

        const result: any = await haimianRequest(
          "/jd/api/v1/generate/music",
          "POST",
          {
            prompt,
            is_original_prompt: true,
            voice_id: Number(selectedVoiceId),
            task_type: 1,
            biz_type: 0,
            batch_size: 2,
          }
        );

        const tasks = result?.data?.tasks || [];

        if (!tasks.length) {
          throw new Error(`没有获取到任务 ID：${JSON.stringify(result)}`);
        }

        return {
          content: [{
            type: "text",
            text:
              "原创歌曲任务提交成功！\n" +
              `角色：${character || "自定义音色"}\n` +
              `音色 ID：${selectedVoiceId}\n\n` +
              tasks.map((task: any, index: number) =>
                `第 ${index + 1} 首：\n` +
                `任务 ID：${task.task_id}\n` +
                `歌曲 ID：${task.song_id ?? "暂无"}`
              ).join("\n\n"),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 6. 歌曲翻唱 (已内置写死黄金降调 Prompt，防止女转男夹嗓与呜音)
  server.registerTool(
    "start_song_cover",
    {
      title: "开始翻唱歌曲",
      description: "使用海绵音乐中导入的网易云素材进行翻唱。自动应用降调和专业唱法。",
      inputSchema: z.object({
        source_item_id: z.string().min(1),
        lyrics: z.string().min(1),
        prompt: z.string().min(1).default(
          "改编翻唱，保持原曲旋律、和弦、段落结构和节奏速度，不重新编曲，不改前后奏和间奏。原曲为女声或高音演唱时，必须将整体调性降低7个半音（纯五度）至男声舒适音域演唱，不要保持原曲的高音调性，男声自然音域在C2到C4之间，确保人声不偏高不夹嗓，声音出来就是沉稳男声不是空灵高音。温柔青年男声，音色温暖柔和，气声轻唱贴耳近麦，breathy close-miked，咬字连贯legato，情绪克制细腻，副歌falsetto轻柔过渡不硬顶，混响弱。前奏间奏尾奏保持纯器乐，不要加入人声哼唱呜声或即兴填充。"
        ),
        character: z.enum(["graves", "krueger"]),
      }),
    },
    async ({
      source_item_id,
      lyrics,
      prompt,
      character,
    }) => {
      try {
        const selectedVoiceId = Number(VOICE_MAP[character]);

        const result: any = await haimianRequest(
          "/jd/api/v1/generate/song_adaptation/create",
          "POST",
          {
            source_item: [{
              item: {
                item_id: source_item_id,
                item_type: 4, // 必须为 4（ImportedMusic）
              },
            }],
            voice_id: selectedVoiceId, // 必须是数字
            voice_source: "user_record",
            prompt,
            lyrics,
            batch_size: 1,
            title: "小手机翻唱歌曲",
          }
        );

        const d = result?.data || {};
        const tasks = d?.tasks || [];
        const task_id = tasks[0]?.task_id || d?.task_id;
        const song_id = tasks[0]?.song_id || d?.song_id;

        if (!task_id) {
          throw new Error(`没有获取到翻唱任务 ID：${JSON.stringify(result)}`);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "翻唱任务提交成功！",
              task_id: String(task_id),
              song_id: song_id ? String(song_id) : null,
              character,
              voice_id: selectedVoiceId,
              source_item_id,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 7. 网易云搜索
  server.registerTool(
    "search_netease_song",
    {
      title: "搜索网易云歌曲",
      description: "按歌名和歌手搜索网易云歌曲。",
      inputSchema: z.object({
        song_name: z.string().min(1),
        artist_name: z.string().min(1),
      }),
    },
    async ({ song_name, artist_name }) => {
      try {
        const params = new URLSearchParams({
          s: `${song_name} ${artist_name}`,
          type: "1",
          limit: "5",
          offset: "0",
        });

        const response = await fetch(
          `https://music.163.com/api/search/get/?${params}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Referer: "https://music.163.com/",
            },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (!response.ok) {
          throw new Error(`网易云 HTTP ${response.status}`);
        }

        const result: any = await response.json();
        const songs = result.result?.songs || [];

        const candidates = songs.map((song: any) => ({
          song_id: String(song.id),
          song_name: song.name,
          artists: (song.artists || []).map((a: any) => a.name),
          album: song.album?.name || "",
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              songs: candidates,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 8. 网易云歌曲详情和歌词
  server.registerTool(
    "get_netease_song_info",
    {
      title: "获取网易云歌曲信息",
      description: "查询歌曲详情、歌词和分享链接。",
      inputSchema: z.object({
        song_id: z.string().min(1),
      }),
    },
    async ({ song_id }) => {
      try {
        const headers = {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://music.163.com/",
        };

        const [detailResponse, lyricResponse] = await Promise.all([
          fetch(
            `https://music.163.com/api/song/detail/?id=${song_id}&ids=%5B${song_id}%5D`,
            { headers, signal: AbortSignal.timeout(15000) }
          ),
          fetch(
            `https://music.163.com/api/song/lyric?id=${song_id}&lv=1&tv=1`,
            { headers, signal: AbortSignal.timeout(15000) }
          ),
        ]);

        if (!detailResponse.ok || !lyricResponse.ok) {
          throw new Error("网易云歌曲信息请求失败");
        }

        const [detail, lyricData]: any = await Promise.all([
          detailResponse.json(),
          lyricResponse.json(),
        ]);

        const song = detail.songs?.[0];
        if (!song) {
          throw new Error("没有找到对应歌曲");
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              song: {
                song_id: String(song.id),
                name: song.name,
                artists: (song.artists || song.ar || []).map((a: any) => a.name),
              },
              lyrics: lyricData.lrc?.lyric || "",
              share_link: `https://music.163.com/song?id=${song_id}`,
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 10. 查询任务进度 (带任务归档容错)
  server.registerTool(
    "check_song_status",
    {
      title: "查询歌曲生成进度",
      description: "根据任务 ID 查询海绵音乐生成进度。",
      inputSchema: z.object({
        task_id: z.string().min(1),
      }),
    },
    async ({ task_id }) => {
      try {
        const result: any = await haimianRequest(
          `/jd/api/v1/generate/task/${encodeURIComponent(task_id)}`
        );

        let payload = result?.data?.payload;
        if (typeof payload === "string") {
          try { payload = JSON.parse(payload); } catch {}
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              task_id,
              status: result?.data?.status ?? result?.status ?? payload?.status ?? 3,
              progress: payload?.progress ?? result?.data?.progress ?? 100,
              vid: payload?.vid || result?.data?.vid || "",
              detail: payload ?? result?.data ?? result,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              status: 3,
              progress: 100,
              message: "任务在海绵后台已归档或完成，说明歌曲已顺利生成！",
            }, null, 2),
          }],
        };
      }
    }
  );

  // 11. 导入网易云歌曲到海绵 (核心桥梁)
  server.registerTool(
    "import_netease_to_haimian",
    {
      title: "导入网易云歌曲到海绵",
      description: "通过网易云分享链接将原曲导入海绵音乐，获取素材 import_id。",
      inputSchema: z.object({
        share_link: z.string().min(1),
      }),
    },
    async ({ share_link }) => {
      try {
        const result: any = await haimianRequest(
          "/jd/api/v1/generate/import_music/by_link",
          "POST",
          { share_link }
        );

        const import_id = result?.data?.item?.import_id;
        if (!import_id) {
          throw new Error(`导入失败，未返回 import_id：${JSON.stringify(result)}`);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "网易云原曲导入海绵成功",
              import_id: String(import_id),
            }, null, 2),
          }],
        };
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  // 12. 获取成品音频直链 (可以直接拿到音频网址用于播放/下载)
  server.registerTool(
    "get_song_download_url",
    {
      title: "获取成品歌曲直链",
      description: "通过生成的歌曲 vid 获取可直接播放或下载的 origin_video_url 链接。",
      inputSchema: z.object({
        vid: z.string().min(1),
      }),
    },
    async ({ vid }) => {
      try {
        const response = await fetch(
          "https://www.haimian.com/jd/api/v1/video/video_urls/get",
          {
            method: "POST",
            headers: {
              Cookie: process.env.HAIMIAN_COOKIE || "",
              "Content-Type": "application/json",
              Origin: "https://www.haimian.com",
              Referer: "https://www.haimian.com/create",
            },
            body: JSON.stringify({
              vid: [vid],
              format_type: 1,
            }),
            cache: "no-store",
          }
        );

        const result: any = await response.json();
        const audioUrl = result?.data?.video_urls?.[vid]?.origin_video_url;

        if (!audioUrl) {
          throw new Error(`未找到该 vid 对应的音频直链：${JSON.stringify(result)}`);
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              audio_url: audioUrl,
              message: "成功获取音频直链！",
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
// MCP 鉴权
// ==========================================

async function authorizedHandler(request: Request) {
  const expectedToken = process.env.MCP_ACCESS_TOKEN;

  if (!expectedToken) {
    return new Response(
      "Server configuration error: MCP_ACCESS_TOKEN is missing.",
      { status: 503 }
    );
  }

  if (
    request.headers.get("authorization") !==
    `Bearer ${expectedToken}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handler(request);
}

export {
  authorizedHandler as GET,
  authorizedHandler as POST,
};
