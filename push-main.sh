#!/usr/bin/env bash
set -euo pipefail
MSG="${1:-chore: update}"
CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
# Ensure main exists locally
if ! git show-ref --verify --quiet refs/heads/main; then
  if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
    git checkout -b main origin/main
  else
    git checkout -b main
  fi
fi
# If not on main, rebase it and merge current branch
if [ "$CUR_BRANCH" != "main" ]; then
  git checkout main
  git pull --rebase || true
  # Merge current branch without fast-forward
  git merge --no-ff -m "Merge branch \"$CUR_BRANCH\" into main" "$CUR_BRANCH" || true
fi
# Stage and commit any pending changes
git add -A || true
if ! git diff --cached --quiet; then
  git commit -m "$MSG"
fi
# Rebase main and push
git pull --rebase || true
git push -u origin main
