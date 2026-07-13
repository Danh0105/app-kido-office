// api.ts
import axios from 'axios';
import { toast } from 'react-hot-toast';

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;

        if (status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        }

        if (status === 403) {
            const token = localStorage.getItem('access_token');
            let isReadOnlyUser = false;
            try {
                const segment = token?.split('.')[1];
                const payload = segment
                    ? JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
                    : null;
                isReadOnlyUser = payload?.roles?.includes('ketoan_truong');
            } catch {
                // Invalid tokens are handled by the authentication flow.
            }
            toast.error(isReadOnlyUser
                ? 'Bạn chỉ có quyền xem'
                : 'Bạn không có quyền truy cập chức năng này');
        }

        return Promise.reject(error);
    },
);

export default api;
