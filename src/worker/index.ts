import { Workspace } from "../workspace/workspace";
export { Workspace };
export interface Env {
  WORKSPACE: DurableObjectNamespace<Workspace>;
  ASSETS: Fetcher;
  OWNER_KEY?: string;
  WEBHOOK_ALLOWED_HOSTS?: string;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const p = new URL(request.url).pathname;
    if (
      p.startsWith("/api/") ||
      p.startsWith("/auth/") ||
      p.startsWith("/owner/")
    )
      return env.WORKSPACE.getByName("primary").fetch(request);
    return env.ASSETS.fetch(request);
  },
};
