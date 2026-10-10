## 1. Research prompt and input

- [x] 1.1 `prompts/system/research.md`: add the formula rule (from `paper-qa.md`), forbid `\(...\)` / `\[...\]`, add the JSON backslash-escaping rule, and add the `📄 paperland://paper/<id>` in-library link rule; describe `in_library` in the input format section
- [x] 1.2 `services/research_list.ts`: `renderListForPrompt` emits `in_library="paperland://paper/<id>"` for verified papers that resolve with a `library_paper_id`; add/adjust unit tests

## 2. Frontend rendering unchanged

- [x] 2.1 Keep `lib/markdown-renderer.ts` as is (no delimiter conversion, per user request); confirm `\(x\)` still renders as plain `(x)`

## 3. Docs and validation

- [x] 3.1 Update `docs/frontend-architecture.md` and `docs/tech-stack.md` (delimiter table lists only `$` / `$$` and explains why backslash delimiters are left unrendered; research prompt rules); confirm `docs/external-api.md` needs no change
- [x] 3.2 `openspec validate fix-research-math-format --strict`
