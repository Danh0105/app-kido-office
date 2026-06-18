import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // cache 5 phút
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});