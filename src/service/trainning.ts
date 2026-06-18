import api from "./api";

export const trainingApi = {
    // =========================
    // TRAINING
    // =========================

    findAll: async () => {
        const res = await api.get("/training");
        return res.data;
    },

    findOne: async (id: number) => {
        const res = await api.get(
            `/training/${id}`,
        );

        return res.data;
    },

    create: async (data: {
        title: string;
        youtubeId: string;
        duration?: number;
        isActive?: boolean;
    }) => {
        const res = await api.post(
            "/training",
            data,
        );

        return res.data;
    },

    update: async (
        id: number,
        data: {
            title?: string;
            youtubeId?: string;
            duration?: number;
            isActive?: boolean;
        },
    ) => {
        const res = await api.patch(
            `/training/${id}`,
            data,
        );

        return res.data;
    },

    remove: async (id: number) => {
        const res = await api.delete(
            `/training/${id}`,
        );

        return res.status === 204
            ? true
            : res.data;
    },

    // =========================
    // PROGRESS
    // =========================

    updateProgress: async (data: {
        trainingId: number;
        watchedSeconds: number;
        lastVideoSecond: number;
        duration: number;
    }) => {
        const res = await api.post(
            "/training/progress",
            data,
        );

        return res.data;
    },

    getMyProgress: async () => {
        const res = await api.get(
            "/training/my/progress",
        );

        return res.data;
    },

    resetTraining: async (
        trainingId: number,
    ) => {
        const res = await api.post(
            `/training/${trainingId}/reset`,
        );

        return res.data;
    },
};
