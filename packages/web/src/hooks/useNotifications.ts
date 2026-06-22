import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotifications(
  apiGet: (path: string, params?: object) => Promise<unknown[]>,
  apiPost: (path: string, body?: object) => Promise<unknown>,
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet("/notifications", { limit: 100 }),
    staleTime: 15_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiPost(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { ...query, markRead, markAllRead };
}
