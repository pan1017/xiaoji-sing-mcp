
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// 创建 MCP 服务
const handler = createMcpHandler((server) => {
  server.registerTool(
    "test_connection",
    {
      title: "测试唱歌服务连接",
      description:
        "测试莫比乌斯小手机与小机唱歌服务之间的连接。",
      inputSchema: z.object({
        message: z.string().optional(),
      }),
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text:
              "小机唱歌服务连接成功！\n" +
              "MCP 服务运行正常。\n" +
              "收到的消息：" +
              (message || "无"),
          },
        ],
      };
    }
  );
});

// 验证访问令牌
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
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  return handler(request);
}

// MCP 使用 GET 和 POST 请求
export {
  authorizedHandler as GET,
  authorizedHandler as POST,
};
