#!/usr/bin/env node
/**
 * Đối chiếu lời gọi API của frontend với route thật của backend.
 *
 * Sinh ra sau sự cố "phân khu vực không lưu": FE gọi /employee/add-many-to-province
 * còn BE phục vụ ở /provinces/add-many-to-province, không ai biết vì 404 trôi qua
 * lặng lẽ. Chạy trước khi phát hành để không lặp lại.
 *
 *   node scripts/check-api-routes.mjs [đường-dẫn-backend]
 *
 * Thoát mã 1 nếu có lời gọi không khớp route nào.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BACKEND = process.argv[2] || '/var/www/sales-management';
const FE_SERVICE_DIR = 'src/service';

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
};

/** Bảng route backend: đọc @Controller + @Get/@Post/... trong *.controller.ts */
function backendRoutes() {
  const routes = [];
  for (const file of walk(join(BACKEND, 'src'))) {
    if (!file.endsWith('.controller.ts')) continue;
    const src = readFileSync(file, 'utf8');
    const base = (src.match(/@Controller\(\s*['"]?([^'")]*)['"]?\s*\)/)?.[1] ?? '').replace(/^\/|\/$/g, '');
    const re = /@(Get|Post|Patch|Delete|Put)\(\s*(?:['"]([^'"]*)['"])?\s*[,)]/g;
    let m;
    while ((m = re.exec(src))) {
      const sub = (m[2] ?? '').replace(/^\/|\/$/g, '');
      const segs = `${base}/${sub}`.split('/').filter(Boolean);
      routes.push({ method: m[1].toUpperCase(), segs });
    }
  }
  return routes;
}

/** Lời gọi của FE: api.get(`/duong/${bien}`) -> segment ${...} coi là tham số */
function frontendCalls() {
  const calls = [];
  for (const file of walk(FE_SERVICE_DIR)) {
    const src = readFileSync(file, 'utf8');
    const re = /api\.(get|post|patch|delete|put)\(\s*[`"']([^`"']+)[`"']/g;
    let m;
    while ((m = re.exec(src))) {
      const path = m[2];
      if (!path.startsWith('/')) continue;
      calls.push({
        method: m[1].toUpperCase(),
        path,
        segs: path.split('?')[0].split('/').filter(Boolean),
        file: relative(process.cwd(), file),
        line: src.slice(0, m.index).split('\n').length,
      });
    }
  }
  return calls;
}

/** Segment tham số phía backend (:id) — nuốt được mọi giá trị. */
const isBackendParam = (s) => s.startsWith(':');
const routes = backendRoutes();
const calls = frontendCalls();

const missing = calls.filter(
  (c) =>
    !routes.some(
      (r) =>
        r.method === c.method &&
        r.segs.length === c.segs.length &&
        // `:id` khớp mọi thứ; còn lại phải trùng đúng chữ. Cố ý KHÔNG cho
        // `${bien}` của FE khớp một segment chữ của BE — giá trị thay lúc chạy
        // không bao giờ bằng đúng chữ đó, khớp kiểu ấy là bỏ lọt lỗi.
        r.segs.every((s, i) => isBackendParam(s) || s === c.segs[i]),
    ),
);

console.log(`Backend: ${routes.length} route · Frontend: ${calls.length} lời gọi`);

if (!missing.length) {
  console.log('✓ Mọi lời gọi đều khớp một route backend.');
  process.exit(0);
}

console.log(`\n✗ ${missing.length} lời gọi không khớp route nào:\n`);
for (const c of missing) {
  console.log(`  ${c.method.padEnd(6)} ${c.path}`);
  console.log(`         ${c.file}:${c.line}`);
}
process.exit(1);
