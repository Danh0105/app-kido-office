import api from './api';

export const notificationApi = {
    // ======================================================
    // COMMON
    // ======================================================

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/unread-count',
        );

        return res.data;
    },

    markAsRead: async (
        id: number,
    ) => {
        const res = await api.patch(
            `/notifications/${id}/read`,
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/read-all',
        );

        return res.data;
    },
    getStats: async () => {
        const res = await api.get('/notifications/stats');

        return res.data;
    },
};

// ==========================================================
// POLICY
// ==========================================================

export const policyNotificationApi = {
    getAll: async (
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications/policy',
            {
                params: {
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/policy/unread-count',
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/policy/read-all',
        );

        return res.data;
    },
};

// ==========================================================
// LỊCH DẠY (Nhân sự gửi cho giáo viên)
// ==========================================================

export const teachingScheduleNotificationApi = {
    getAll: async (
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications/teaching-schedule',
            {
                params: {
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/teaching-schedule/unread-count',
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/teaching-schedule/read-all',
        );

        return res.data;
    },
};

// ==========================================================
// SUGGEST
// ==========================================================

export const suggestNotificationApi = {
    getAll: async (
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications',
            {
                params: {
                    type: 'SUGGEST',
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/suggest/unread-count',
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/suggest/read-all',
        );

        return res.data;
    },
};

// ==========================================================
// REPORT
// ==========================================================

export const reportNotificationApi = {
    getAll: async (
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications/report',
            {
                params: {
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/report/unread-count',
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/report/read-all',
        );

        return res.data;
    },

    getGrouped: async (
        tab?: 'unread' | 'read',
        date?: string,
    ) => {
        const res = await api.get(
            '/notifications/report/grouped',
            { params: { tab, date: date || undefined } },
        );
        return res.data;
    },

    getBySender: async (
        senderId: number,
        page = 1,
        limit = 20,
        tab?: 'unread' | 'read',
        date?: string,
    ) => {
        const res = await api.get(
            `/notifications/report/sender/${senderId}`,
            { params: { page, limit, tab, date: date || undefined } },
        );
        return res.data;
    },

    markAllAsReadBySender: async (senderId: number) => {
        const res = await api.patch(
            `/notifications/report/sender/${senderId}/read-all`,
        );
        return res.data;
    },
};

// ==========================================================
// WEEKLY PLAN
// ==========================================================

export const weeklyPlanNotificationApi = {
    getAll: async (
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications/plan',
            {
                params: {
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },

    getUnreadCount: async () => {
        const res = await api.get(
            '/notifications/plan/unread-count',
        );

        return res.data;
    },

    markAllAsRead: async () => {
        const res = await api.patch(
            '/notifications/plan/read-all',
        );

        return res.data;
    },

};

// ==========================================================
// GIẢNG DẠY — xác nhận lịch & báo giảng (gửi cho Giáo vụ/Nhân sự)
// ==========================================================
// Chưa có endpoint riêng như POLICY/REPORT — 3 type này dùng thẳng
// GET /notifications?type=... (endpoint chung, đã lọc theo receiverId).
export type TeachingAlertType =
    | 'TEACHING_SCHEDULE_CONFIRM_RESULT'
    | 'TEACHING_SCHEDULE_CONFIRM_ALERT'
    | 'TEACHING_LESSON_REPORT_ALERT'
    | 'TEACHER_LOCATION_CHANGE_REQUEST'
    | 'TEACHING_REPLACEMENT_REQUEST';

export const teachingAlertNotificationApi = {
    getAll: async (
        type: TeachingAlertType,
        page = 1,
        limit = 10,
        tab?: 'unread' | 'read',
    ) => {
        const res = await api.get(
            '/notifications',
            {
                params: {
                    type,
                    page,
                    limit,
                    tab,
                },
            },
        );

        return res.data;
    },
};
