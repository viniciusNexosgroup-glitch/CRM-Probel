export type UntypedSupabase = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export function salesbotDb(client: unknown): UntypedSupabase {
  return client as UntypedSupabase;
}
