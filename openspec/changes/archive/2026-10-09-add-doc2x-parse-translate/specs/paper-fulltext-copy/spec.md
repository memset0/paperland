## Purpose
Let users copy a paper's full extracted text to the clipboard in each available version (mechanical parse and doc2x Markdown) from the detail page.

## ADDED Requirements

### Requirement: Copy full text buttons
The paper detail page SHALL show two buttons, "复制全文（直接解析）" and "复制全文（doc2x）", which copy `contents.pdf_parsed` and `contents.doc2x_parsed` respectively to the clipboard and show a success toast. Each button SHALL be disabled (not clickable) until its source text exists, and SHALL become enabled once the corresponding parse has completed without requiring a manual page reload while the page is open.

#### Scenario: Only mechanical parse done
- **WHEN** a paper has `contents.pdf_parsed` but no `contents.doc2x_parsed`
- **THEN** "复制全文（直接解析）" SHALL be enabled and "复制全文（doc2x）" SHALL be disabled

#### Scenario: Copy doc2x text
- **WHEN** doc2x parsing has completed and the user clicks "复制全文（doc2x）"
- **THEN** the clipboard SHALL contain the doc2x Markdown and a success toast SHALL be shown

#### Scenario: Becomes available after parse
- **WHEN** the detail page is open while doc2x parsing finishes
- **THEN** the "复制全文（doc2x）" button SHALL become enabled after the next status refresh
