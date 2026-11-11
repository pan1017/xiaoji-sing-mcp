
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// 创建 MCP 服务，并注册一个测试工具
const mcpHandler = createMcpHandler((server) => {
  server.registerTool(
    "test_connection",
    {
      description:
        "测试小手机与唱歌服务之间的 MCP 连接是否正常。",
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
              "收到的测试消息：" +
              (message || "无"),
          },
        ],
      };
    }
  );
});

// 访问令牌验证，防止其他人随意调用服务
export default {
  async fetch(request: Request): Promise<Response> {
    const expectedToken = process.env.MCP_ACCESS_TOKEN;

    // 没有配置令牌时，不允许开放服务
    if (!expectedToken) {
      return new Response(
        "Server configuration error: MCP_ACCESS_TOKEN is missing.",
        { status: 503 }
      );
    }

    // 检查请求中的 Bearer Token
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${expectedToken}`) {
      return new Response("Unauthorized", {
        status: 401,
      });
    }

    // 验证通过后，交给 MCP 处理程序
    return mcpHandler(request);
  },
};
