## Decisions

- Filter in the list query (`WHERE uploaded_by = :me` for non-admins), not in the client, so other users' images never leave the server.
- Admin rows get `uploaded_by_name` via a left join on `users` (nickname, else username); non-admin rows carry it too (their own name) for a uniform shape. The page shows it only to admins.
- Ownership stays single-valued (`images.uploaded_by` = first uploader). Content dedup returns an existing row on re-upload, so a user re-uploading bytes another user already uploaded will not see that image in their list. Accepted for now (rare; tracking per-user upload links would need a new table).
- MCP `upload_image` already passes the token owner as `userId` to `storeImage`; no code change there.
