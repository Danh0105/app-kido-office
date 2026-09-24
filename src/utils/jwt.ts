/**
 * Giải mã phần payload của JWT (đoạn giữa, mã base64url).
 *
 * `atob()` trả về chuỗi byte — mỗi ký tự là 1 byte. `JSON.parse` thẳng chuỗi đó
 * sẽ đọc từng byte thành một ký tự Latin-1, làm tên tiếng Việt hỏng dấu
 * ("Nhân sự" -> "NhÃ¢n sá»±"). Phải dựng lại mảng byte rồi decode UTF-8.
 */
export const decodeJwtPayload = (token?: string | null): any | null => {
    const segment = (token || "").split(".")[1];
    if (!segment) return null;

    try {
        const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
        // base64url bỏ dấu "=" ở cuối, atob() thì cần đủ bội số của 4.
        const padded = base64.padEnd(
            base64.length + ((4 - (base64.length % 4)) % 4),
            "=",
        );
        const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));

        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
        console.log("decode error", e);
        return null;
    }
};
