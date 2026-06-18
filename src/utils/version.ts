export const isNewerVersion = (server: string, local: string): boolean => {
    if (!server || !local) return false;

    const s = server.split('.').map(Number);
    const l = local.split('.').map(Number);

    const maxLength = Math.max(s.length, l.length);

    for (let i = 0; i < maxLength; i++) {
        const sv = s[i] || 0;
        const lv = l[i] || 0;

        if (sv > lv) return true;
        if (sv < lv) return false;
    }

    return false;
};