set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

setup:
    npm install

dev:
    npm run start

run:
    npm run start

test:
    npm run test

lint:
    npm run lint:check

lint-fix:
    npm run lint:fix

format:
    npx prettier --write .

format-check:
    npx prettier --check .

build:
    npm run build

release:
    npm run release

pre-commit:
    just lint
    just test
    just build
