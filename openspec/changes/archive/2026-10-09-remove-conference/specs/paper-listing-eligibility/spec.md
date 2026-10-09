## REMOVED Requirements

### Requirement: OpenReview-only papers cannot be listed
**Reason**: "OpenReview-only" was defined by OpenReview links stored in `conference_papers`; with the Conference feature and that table removed, no paper can be OpenReview-only, so the listing guard, the derived `listable` flag, and the related UI hint have nothing to evaluate.
**Migration**: Any paper may be set to `listed=true` again. Paper API responses no longer include `listable` or `openreview_links`, and `LISTING_NOT_ALLOWED` is no longer returned.

### Requirement: Papers expose a derived listable flag
**Reason**: "OpenReview-only" was defined by OpenReview links stored in `conference_papers`; with the Conference feature and that table removed, no paper can be OpenReview-only, so the listing guard, the derived `listable` flag, and the related UI hint have nothing to evaluate.
**Migration**: Any paper may be set to `listed=true` again. Paper API responses no longer include `listable` or `openreview_links`, and `LISTING_NOT_ALLOWED` is no longer returned.

### Requirement: Existing wrongly-listed papers are corrected
**Reason**: "OpenReview-only" was defined by OpenReview links stored in `conference_papers`; with the Conference feature and that table removed, no paper can be OpenReview-only, so the listing guard, the derived `listable` flag, and the related UI hint have nothing to evaluate.
**Migration**: Any paper may be set to `listed=true` again. Paper API responses no longer include `listable` or `openreview_links`, and `LISTING_NOT_ALLOWED` is no longer returned.

### Requirement: Frontend disables listing for non-listable papers
**Reason**: "OpenReview-only" was defined by OpenReview links stored in `conference_papers`; with the Conference feature and that table removed, no paper can be OpenReview-only, so the listing guard, the derived `listable` flag, and the related UI hint have nothing to evaluate.
**Migration**: Any paper may be set to `listed=true` again. Paper API responses no longer include `listable` or `openreview_links`, and `LISTING_NOT_ALLOWED` is no longer returned.
