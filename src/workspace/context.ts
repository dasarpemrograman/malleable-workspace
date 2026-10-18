import type { Env } from "../worker";
import type { Kind, Resource, Principal, Scope } from "../domain/model";
import type { WorkspaceStore } from "./store";

// Capabilities owned by one Durable Object; not an RPC interface.
export interface WorkspaceContext {
  storage: DurableObjectStorage;
  env: Env;
  store: WorkspaceStore;
  authorize(principal: Principal, scope?: Scope): void;
  body(request: Request, max?: number): Promise<unknown>;
  principal(request: Request, epoch: string): Promise<Principal>;
  login(request: Request, epoch: string): Promise<Response>;
  listItems(url: URL): unknown;
  mutate(
    kind: Kind,
    key: string | undefined,
    input: unknown,
    principal: Principal,
  ): Promise<Resource>;
  emit(type: string, resource: Resource, actor: string): Promise<void>;
  schedule(): Promise<void>;
  ownerRoute(
    request: Request,
    url: URL,
    principal: Principal,
  ): Promise<Response>;
}
