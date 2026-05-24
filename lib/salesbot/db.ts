export type UntypedSupabase = {
  from: (table: string) => any;
};

export function salesbotDb(client: unknown): UntypedSupabase {
  return client as UntypedSupabase;
}
