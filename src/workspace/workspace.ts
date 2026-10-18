import { DurableObject } from "cloudflare:workers";
import type { Env } from "../worker";
import { WorkspaceStore } from "./store";
import type { WorkspaceContext } from "./context";
import { authorize, body, principal, login } from "./auth";
import { fetch as handleRequest, listItems, mutate } from "./routes";
import { ownerRoute } from "./owner-routes";
import { emit, schedule, alarm } from "./deliveries";

export class Workspace extends DurableObject<Env> {
  private readonly services: WorkspaceContext;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const store = new WorkspaceStore(ctx.storage);
    ctx.blockConcurrencyWhile(() => store.initialize());
    const services: WorkspaceContext = {
      storage: ctx.storage,
      env,
      store,
      authorize: (p, scope) => authorize(services, p, scope),
      body: (request, max) => body(services, request, max),
      principal: (request, epoch) => principal(services, request, epoch),
      login: (request, epoch) => login(services, request, epoch),
      listItems: (url) => listItems(services, url),
      mutate: (kind, key, input, p) => mutate(services, kind, key, input, p),
      emit: (type, resource, actor) => emit(services, type, resource, actor),
      schedule: () => schedule(services),
      ownerRoute: (request, url, p) => ownerRoute(services, request, url, p),
    };
    this.services = services;
  }

  async fetch(request: Request): Promise<Response> {
    return handleRequest(this.services, request);
  }

  async alarm() {
    return alarm(this.services);
  }
}
