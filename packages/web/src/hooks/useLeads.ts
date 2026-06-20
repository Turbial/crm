import { useQuery } from "@tanstack/react-query";
import type { UseLeadsOptions } from "../types";

export function useLeads(apiGet: (path: string, params?: object) => Promise<unknown[]>, opts: UseLeadsOptions = {}) {
  return useQuery({
    queryKey: ["leads", opts],
    queryFn: () => apiGet("/leads", opts),
    staleTime: 30_000,
  });
}
