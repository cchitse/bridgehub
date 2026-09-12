import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../../../lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const allowedOrigin = process.env.BRIDGEHUB_ORIGIN;
  const hosts = ["127.0.0.1", "localhost", "[::1]"];
  if (allowedOrigin) hosts.push(new URL(allowedOrigin).hostname);
  const host = request.headers.get("host") ?? url.host;
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return new Response("Host not allowed", { status: 403 });
  }
  if (!hosts.includes(url.hostname) || !hosts.includes(hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin && origin !== allowedOrigin) {
    return new Response("Origin not allowed", { status: 403 });
  }
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export async function GET() {
  return new Response("Use MCP Streamable HTTP POST. This server has no event stream.", { status: 405, headers: { Allow: "POST" } });
}

export const DELETE = GET;
