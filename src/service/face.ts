import api from "./api";

export const faceApi = {
    // 🔐 LOGIN FACE
    login: async (descriptor: number[]) => {
        const res = await api.post(`/face/login`, {
            descriptor,
        });
        return res.data;
    },

    // 📸 REGISTER FACE (cần token)
    registerEmployee: async ({
        descriptors,
    }: {
        descriptors: number[][];
    }) => {
        const res = await api.post('/face/register-employee', {
            descriptors,
        });

        return res.data;
    }
};