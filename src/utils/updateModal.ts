export const showUpdateModal = (data: any) => {
    const confirm = window.confirm(
        `Có bản mới (${data.version})\n${data.note || ''}\nBạn có muốn cập nhật?`
    );

    if (confirm) {
        downloadApk(data.apkUrl);
    }
};