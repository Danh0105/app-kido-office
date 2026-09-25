# Backend Update — khu vực Vũng Tàu trong Chấm công

## Bối cảnh

Sau thay đổi địa giới, các phường thuộc Bà Rịa–Vũng Tàu đang mang
`provinceId = Hồ Chí Minh`. Màn Chấm công cần tách thành hai lựa chọn:

- **Vũng Tàu**: chỉ các trường thuộc địa bàn Vũng Tàu cũ.
- **Hồ Chí Minh**: trường Hồ Chí Minh, không gồm Vũng Tàu.

## Query mới

Hai endpoint dưới nhận `region`:

```text
GET /teaching-sessions?region=VUNG_TAU
GET /teaching-schedules?region=VUNG_TAU
```

Giá trị hỗ trợ:

- `VUNG_TAU`: lọc các trường có ward thuộc Vũng Tàu.
- `HO_CHI_MINH_CORE`: `provinceId = Hồ Chí Minh`, loại trừ các ward Vũng Tàu.

Áp dụng cùng các query đang có (ngày, giáo viên, trường, trạng thái), trước
khi tính `total` và phân trang.

## Dữ liệu phân vùng

Không nhận diện bằng tên trường. Lưu một cờ/danh mục vùng bền vững trên ward
hoặc school (khuyến nghị `operationalRegion = VUNG_TAU | HO_CHI_MINH_CORE | …`).
Danh sách ward Vũng Tàu hiện FE đang dùng để tương thích dữ liệu cũ:

```text
18, 24, 79, 151, 179, 439
```

Backend là nguồn quyết định chính thức; nếu có ward mới hoặc chuyển trường,
chỉ cần cập nhật danh mục vùng, không sửa frontend.
