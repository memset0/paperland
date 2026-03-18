# pdf-parse Specification

## Purpose
TBD - created by archiving change pdf-parse-service. Update Purpose after archive.
## Requirements
### Requirement: Parse PDF to text
The pdf_parse_service SHALL read a PDF file and extract its text content.

#### Scenario: Successful parse
- **WHEN** the service executes for a paper with pdf_path pointing to a valid PDF
- **THEN** the extracted text SHALL be stored in contents.pdf_parsed

### Requirement: Service declaration
The service SHALL be registered with depends_on=["pdf_path"] and produces=["contents.pdf_parsed"].

#### Scenario: Registration
- **WHEN** the server starts
- **THEN** pdf_parse_service SHALL be registered with ServiceRunner

