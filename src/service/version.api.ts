import api from './api';

export interface VersionResponse {
    version: string;
    apkUrl: string;
    force: boolean;
    note?: string;
}

export const getVersion = async (): Promise<VersionResponse> => {
    const res = await api.get('/version');
    return res.data;
};