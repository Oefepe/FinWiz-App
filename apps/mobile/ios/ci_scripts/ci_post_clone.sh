#!/bin/zsh
# Xcode Cloud post-clone hook.
# Runs on Apple's macOS build image right after it checks out the repo,
# before any Xcode build/archive action. Xcode Cloud auto-discovers this
# script by its location (ios/ci_scripts/ci_post_clone.sh) — no extra
# workflow config needed to trigger it.
#
# This repo doesn't commit generated native projects (see the monorepo's
# root .gitignore — apps/mobile/ios and apps/mobile/android are ignored).
# The ios/ directory that exists at repo-inspection time (so Xcode Cloud
# has something to point a workflow at) is a placeholder generated the
# same way — this script regenerates it fresh from app.json/plugins on
# every build ("continuous native generation") so it can never drift from
# the source of truth.
set -euo pipefail

echo "==> ci_post_clone: starting"

# $CI_WORKSPACE is the monorepo root as cloned by Xcode Cloud.
# $CI_PRIMARY_REPOSITORY_PATH is equivalent; both point to the same clone.
cd "$CI_WORKSPACE"

echo "==> Installing Node (Xcode Cloud images ship Homebrew, not Node)"
brew install node@20
export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"
node -v
npm -v

# ci_post_clone.sh's own `export`s do NOT carry over into the later Xcode
# build/archive step (separate process) — and ios/.xcode.env resolves
# NODE_BINARY via `command -v node` at build-script-phase time. Symlink
# into /usr/local/bin (on PATH for every step, Apple Silicon or Intel
# runners alike) so that later lookup actually finds it.
sudo ln -sf "$(command -v node)" /usr/local/bin/node

echo "==> Enabling Corepack / Yarn"
corepack enable
yarn -v

echo "==> Installing monorepo dependencies (yarn workspaces: apps/*, packages/*)"
yarn install --frozen-lockfile

echo "==> Regenerating the iOS native project from app.json (expo prebuild)"
cd "$CI_WORKSPACE/apps/mobile"
npx expo prebuild -p ios --no-install --clean

echo "==> Installing CocoaPods dependencies"
cd ios
# CocoaPods ships with Xcode Cloud's macOS image already — no gem install needed here.
pod install

echo "==> ci_post_clone: done"
