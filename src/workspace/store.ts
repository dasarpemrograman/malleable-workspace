import {
  AppError,
  requireThat,
  fresh,
  name,
  id,
  revision,
  type Resource,
  type Item,
  type Meta,
} from "../domain/model";

export class WorkspaceStore {
  constructor(readonly storage: DurableObjectStorage) {}
  async initialize() {
    this.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS migration (version INTEGER NOT NULL)",
    );
    const current =
      this.storage.sql
        .exec<{ version: number }>("SELECT version FROM migration")
        .toArray()[0]?.version ?? 0;
    if (current > 1)
      throw new Error(
        "Unsupported newer schema. Use compatible code; do not downgrade.",
      );
    if (current === 0) {
      const tables = this.storage.sql
        .exec<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='records'",
        )
        .toArray();
      if (tables.length) {
        const bookmark = await this.storage.getCurrentBookmark();
        await this.storage.put("preMigrationBookmark", bookmark);
      }
      this.storage.transactionSync(() => {
        this.storage.sql.exec(
          "CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id))",
        );
        this.storage.sql.exec(
          "CREATE INDEX IF NOT EXISTS item_order ON records(kind,json_extract(data,'$.createdAt'),id)",
        );
        this.storage.sql.exec(
          "CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
        );
        this.storage.sql.exec(
          "CREATE TABLE IF NOT EXISTS throttles (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)",
        );
        this.storage.sql.exec("DELETE FROM migration");
        this.storage.sql.exec("INSERT INTO migration VALUES (1)");
        if (!this.metaOptional()) {
          this.setMeta({
            id: crypto.randomUUID(),
            schemaRevision: 1,
            pristine: true,
            version: 1,
          });
          this.put("type", { ...fresh(), name: "Item" });
        }
      });
    }
  }
  all<T>(kind: string): T[] {
    return this.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind=? ORDER BY id",
        kind,
      )
      .toArray()
      .map((r) => JSON.parse(r.data) as T);
  }

  get<T>(kind: string, key: string): T {
    const r = this.storage.sql
      .exec<{ data: string }>(
        "SELECT data FROM records WHERE kind=? AND id=?",
        kind,
        key,
      )
      .toArray()[0];
    if (!r) throw new AppError(404, "not_found", "The resource was not found.");
    return JSON.parse(r.data) as T;
  }

  put<T extends { id: string }>(kind: string, r: T) {
    this.storage.sql.exec(
      "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      kind,
      r.id,
      JSON.stringify(r),
    );
  }

  remove(kind: string, key: string) {
    this.storage.sql.exec(
      "DELETE FROM records WHERE kind=? AND id=?",
      kind,
      key,
    );
  }

  metaOptional(): Meta | undefined {
    const r = this.storage.sql
      .exec<{ data: string }>("SELECT data FROM settings WHERE id='workspace'")
      .toArray()[0];
    return r ? JSON.parse(r.data) : undefined;
  }

  meta(): Meta {
    return this.metaOptional()!;
  }

  setMeta(m: Meta) {
    this.storage.sql.exec(
      "INSERT INTO settings VALUES('workspace',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      JSON.stringify(m),
    );
  }

  dirty(schema = false) {
    const m = this.meta();
    m.pristine = false;
    if (schema) m.schemaRevision++;
    this.setMeta(m);
  }

  checkRevision(r: Resource, expected: number) {
    requireThat(
      r.revision === expected,
      "revision_conflict",
      "This record changed. Reload its current revision before retrying.",
      409,
    );
  }
}
