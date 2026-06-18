import { policiesApi } from "@/service/policy";
import { useQuery } from "@tanstack/react-query";

export const usePolicyStats = (params: {
    employeeId: number;
    fromDate?: string;
    toDate?: string;
}) => {
    return useQuery({
        queryKey: ["policy-stats", params],
        queryFn: () => policiesApi.getStatsAdvanced(params),
        staleTime: 1000 * 60 * 5,
    });
};