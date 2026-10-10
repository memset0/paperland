## MODIFIED Requirements

### Requirement: Viewer shows PDF availability and upload entry
The paper detail viewer panel SHALL always show the "PDF" tab. When the paper has no PDF:
- with `pdf_status` "fetching" it SHALL show a "Fetching PDF…" state and refresh the paper periodically until the status changes;
- with `pdf_status` "upload_required" it SHALL show a "PDF needed" panel that states the reason (closed access / automatic download failed / no PDF source found) and offers a file picker and drag-and-drop upload limited to PDF files.
After a successful upload the panel SHALL refresh the paper and render the PDF without a page reload. Anonymous viewers SHALL see the reason but no upload control. Upload errors SHALL be shown in the panel.

#### Scenario: Closed-access paper opened
- **WHEN** a user opens a closed-access paper without a PDF
- **THEN** the left panel SHALL show "PDF needed" with the closed-access reason and an upload control

#### Scenario: Upload from the panel
- **WHEN** the user drops a PDF onto the panel
- **THEN** it SHALL be uploaded and the PDF viewer SHALL replace the panel once the upload succeeds
