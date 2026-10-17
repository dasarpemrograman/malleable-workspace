import worker from "../src/worker";
import { Workspace } from "../src/workspace/workspace";
export default {
  fetch(request: Request, env: Parameters<typeof worker.fetch>[1]) {
    // Miniflare's dispatch proxy replaces Host with its listener address. Restore
    // the synthetic ingress Host only in this fixture, including invalid-Host cases.
    const headers = new Headers(request.headers);
    headers.set(
      "Host",
      headers.get("x-fixture-host") ?? new URL(request.url).host,
    );
    headers.delete("x-fixture-host");
    return worker.fetch(new Request(request, { headers }), env);
  },
};
// Test-only RPCs are bundled into the fixture, never the deployed entry point.
export class TestWorkspace extends Workspace {
  testSQL(sql: string, ...args: (string | number | null)[]) {
    return this.ctx.storage.sql.exec(sql, ...args).toArray();
  }
  async testAlarm() {
    return this.alarm();
  }
  async testClearAlarm() {
    await this.ctx.storage.deleteAlarm();
  }
}
