## Decisions

- Step markup: `<step index="N" kind="agent" status="done|failed|cancelled">` with `<user_message>…</user_message>`, then `<changes>…</changes>` for done rounds (within budget) or `<note>The round run after this user message failed (or: was cancelled by the user) and produced no new version.</note>`. Title edits keep `<step index="N" kind="title_edit">The user edited titles: …</step>`.
- A done round that produced no version (parse failure after repair) is still `status="done"`; its missing version is visible from `<current_version>` and its absent `changes` note. No extra note, to keep the rule simple.
- Active steps (queued / awaiting_output / streaming) are excluded: they are only ever the round being assembled (one active round per session).
- The budget logic is unchanged: user messages and status notes always appear; `changes` notes are dropped oldest-first.
