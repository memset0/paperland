## 1. Create GitHub Actions Workflow

- [x] 1.1 Create `.github/workflows/build-zotero-plugin.yml` with trigger conditions: push to main (paths: `packages/zotero-plugin/**`, `.github/workflows/build-zotero-plugin.yml`) and `workflow_dispatch`
- [x] 1.2 Configure job: `ubuntu-latest` runner, checkout repo, setup Bun via `oven-sh/setup-bun`, run `bun install` from project root
- [x] 1.3 Add build step: run `bun run build` in `packages/zotero-plugin/` directory
- [x] 1.4 Add upload step: use `actions/upload-artifact` to upload `.xpi` file as `zotero-plugin-xpi` artifact

## 2. Verify

- [x] 2.1 Verify workflow YAML syntax is valid and all paths are correct
