import assert from 'node:assert/strict';
import test from 'node:test';
import { rankSearchKey, toSearchKey } from '../src/utils/text.ts';

// Tên lấy theo đúng các kiểu đang có trong bảng schools.
const SCHOOLS = [
  { name: 'TRƯỜNG TIỂU HỌC BÌNH KHÁNH', address: 'Ấp Bình Thạnh, Xã Bình Khánh, TP Hồ Chí Minh' },
  { name: 'TH Bạch Đằng', address: '57 Lê Quốc Hưng, Phường Xóm Chiếu' },
  { name: 'TRUNG HỌC CƠ SỞ BÙI VĂN THỦ', address: '139 Đường Bùi Văn Thủ, Xã Bà Điểm' },
  { name: 'THCS NGUYỄN ĐÌNH CHIỂU', address: '246 Tổ Dân Phố Trại Mát, Phường Xuân Trường - Đà Lạt' },
  { name: 'TRƯỜNG THPT NGUYỄN HỮU CẦU', address: 'Số 3 Đường Tô Ký, Xã Bà Điểm' },
  { name: 'MẦM NON HOA SEN', address: '' },
  { name: 'TH&THCS Đa Kia', address: '' },
];

const search = (query) => {
  const queryKey = toSearchKey(query);
  return SCHOOLS
    .map((s, index) => ({
      s, index,
      rank: rankSearchKey(toSearchKey(s.name), queryKey, toSearchKey(s.address)),
    }))
    .filter((r) => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.s.name);
};

test('toSearchKey quy các cách viết loại trường về cùng một khoá', () => {
  assert.equal(toSearchKey('TRƯỜNG TIỂU HỌC BÌNH KHÁNH'), 'th binh khanh');
  assert.equal(toSearchKey('Tiểu học Bình Khánh'), 'th binh khanh');
  assert.equal(toSearchKey('TH Bình Khánh'), 'th binh khanh');
  assert.equal(toSearchKey('Trung học cơ sở Bùi Văn Thủ'), 'thcs bui van thu');
  assert.equal(toSearchKey('trung hoc pho thong'), 'thpt');
  assert.equal(toSearchKey('MẦM NON Hoa Sen'), 'mn hoa sen');
  assert.equal(toSearchKey('TH&THCS Đa Kia'), 'th thcs da kia');
  assert.equal(toSearchKey('  '), '');
});

test('gõ không dấu, viết tắt hay viết đầy đủ đều ra trường', () => {
  assert.deepEqual(search('tieu hoc binh khanh'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH']);
  assert.deepEqual(search('th binh khanh'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH']);
  assert.deepEqual(search('trường th bạch đằng'), ['TH Bạch Đằng']);
  assert.deepEqual(search('thcs bui van thu'), ['TRUNG HỌC CƠ SỞ BÙI VĂN THỦ']);
  assert.deepEqual(search('mam non hoa sen'), ['MẦM NON HOA SEN']);
});

test('không cần đúng thứ tự từ, gõ dính liền vẫn ra', () => {
  assert.deepEqual(search('binh khanh tieu hoc'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH']);
  assert.deepEqual(search('binhkhanh'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH']);
  assert.deepEqual(search('dinh chieu'), ['THCS NGUYỄN ĐÌNH CHIỂU']);
});

test('tìm được theo địa chỉ, nhưng khớp tên luôn xếp trước', () => {
  assert.deepEqual(search('ba diem'), ['TRUNG HỌC CƠ SỞ BÙI VĂN THỦ', 'TRƯỜNG THPT NGUYỄN HỮU CẦU']);
  assert.deepEqual(search('xom chieu'), ['TH Bạch Đằng']);
  // "chieu" khớp tên Nguyễn Đình Chiểu (hạng 2) trước địa chỉ Xóm Chiếu (hạng 4).
  assert.deepEqual(search('chieu'), ['THCS NGUYỄN ĐÌNH CHIỂU', 'TH Bạch Đằng']);
});

test('loại trường khớp nguyên từ: tiểu học không lẫn THCS/THPT', () => {
  assert.deepEqual(search('tieu hoc'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH', 'TH Bạch Đằng', 'TH&THCS Đa Kia']);
  assert.deepEqual(search('th'), ['TRƯỜNG TIỂU HỌC BÌNH KHÁNH', 'TH Bạch Đằng', 'TH&THCS Đa Kia']);
  assert.deepEqual(search('thcs'), ['TRUNG HỌC CƠ SỞ BÙI VĂN THỦ', 'THCS NGUYỄN ĐÌNH CHIỂU', 'TH&THCS Đa Kia']);
});

test('chữ "trường" trong địa danh vẫn được giữ để tìm', () => {
  assert.equal(toSearchKey('Phường Xuân Trường - Đà Lạt'), 'phuong xuan truong da lat');
  assert.equal(toSearchKey('Trường THPT Nguyễn Hữu Cầu'), 'thpt nguyen huu cau');
  assert.deepEqual(search('xuan truong'), ['THCS NGUYỄN ĐÌNH CHIỂU']);
});

test('tên trùng khớp hoàn toàn đứng đầu, rồi đến tên bắt đầu bằng từ khoá', () => {
  assert.equal(rankSearchKey('th bach dang', 'th bach dang'), 0);
  assert.equal(rankSearchKey('th bach dang 2', 'th bach dang'), 1);
  assert.equal(rankSearchKey('th bach dang', 'bach dang'), 2);
  assert.equal(rankSearchKey('th bach dang', 'hoa sen'), null);
});

test('từ khoá rỗng (hoặc chỉ có chữ "trường") giữ nguyên danh sách', () => {
  assert.equal(search('').length, SCHOOLS.length);
  assert.equal(search('trường').length, SCHOOLS.length);
});
