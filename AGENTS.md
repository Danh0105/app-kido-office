# AGENTS.md

## Live repos

`/var/www/sales-management` and `/var/www/kido-app` serve production from `dist/`. Never run `npm run build` in them, and never restart pm2 `sales-management` after building there. Build from a clean worktree of `release/unified` (backend) or `release/fe-unified` (frontend).
