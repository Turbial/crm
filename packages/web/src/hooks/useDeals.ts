import { useQuery } from "@tanstack/react-query";
import type { UseDealsOptions } from "../types";

export function useDeals(apiGet: (path: string, params?: object) => Promise<unknown[]>, opts: UseDealsOptions = {}) {
  return useQuery({
    queryKey: ["deals", opts],
    queryFn: () => apiGet("/deals", opts),
    staleTime: 30_000,
  });
}
