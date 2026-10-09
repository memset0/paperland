# contextual-qa Specification

## Purpose
Generalizes paper Q&A into an instruction plus ordered inputs (a selected passage, a region screenshot, or prior conversation) and a question, so selection asking, screenshot asking, and follow-up trees all run through the existing Q&A pipeline.

## Requirements

### Requirement: Q&A entries carry an instruction and ordered inputs
A free Q&A entry SHALL record an optional named instruction from `config.yml`, an immutable ordered list of inputs, and the question. Supported input kinds SHALL be a PDF text selection (text plus page/offset anchor), a PDF region image (image URL plus page/rect anchor), and conversation history (a reference to one prior answer; history text SHALL NOT be copied). An entry SHALL have at most one history input. An entry created with only a question and models SHALL behave exactly as free Q&A does today.

#### Scenario: Legacy free question unchanged
- **WHEN** a client creates a free Q&A with only `question` and `models`
- **THEN** the entry SHALL use the default instruction with no extra inputs and answer as before

#### Scenario: Selection input recorded
- **WHEN** a user asks about a selected PDF passage
- **THEN** the entry SHALL store the passage text and its page/offset anchor as a `text_selection` input

#### Scenario: Image input requires a vision model
- **WHEN** an entry with an `image` input is submitted for a model not declared image-capable
- **THEN** the request SHALL be rejected with 400 and no entry SHALL be created

### Requirement: Model input is assembled from instruction, paper, inputs, and history
Each run SHALL send the system prompt as system content and, as user content, the paper's full text chosen by `content_priority`, the paper's cited references, the inputs of the whole conversation chain, the ancestor conversation, and the question, in that order. Q&A SHALL be unavailable for a paper with no usable full text: creating any Q&A entry (preset, free, direct ask, screenshot ask, or follow-up) for such a paper SHALL be rejected with 409, and the frontend SHALL disable the ask actions with a hint.

#### Scenario: Paper without full text
- **WHEN** a user tries to ask any question on a paper with no parsed or user-provided content
- **THEN** the request SHALL be rejected with 409, no entry SHALL be created, and the ask actions SHALL be shown disabled

### Requirement: Follow-up questions form a tree
A user SHALL be able to ask a follow-up on any specific answer (Result), either by typing their own question or by activating a model-suggested `#moonlight` follow-up link that pre-fills the question. A follow-up SHALL be a child entry whose inputs include a history input referencing the exact parent Result, and its run SHALL include the ancestor questions and selected answers, read by the backend along the reference chain, as conversation history. The parent answer SHALL be visible to the asker when the follow-up is created.

#### Scenario: User-typed follow-up
- **WHEN** a user clicks 追问 under an answer and submits their own question
- **THEN** a child entry SHALL be created referencing that answer, and the run SHALL include the conversation up to that answer

#### Scenario: Suggested follow-up link
- **WHEN** a user clicks a `[💬 question](#moonlight)` link in an answer
- **THEN** the page SHALL NOT navigate; a follow-up input SHALL open pre-filled with the link text for that answer

#### Scenario: Follow-up on another user's shared Q&A
- **WHEN** a user follows up on an answer belonging to another user's Q&A that is visible to them through sharing
- **THEN** the follow-up SHALL be created and owned by the follow-up asker, with visibility governed only by the asker's own `qa` switch

#### Scenario: Parent later unshared
- **WHEN** the parent Q&A's owner later turns off `qa` sharing
- **THEN** the backend SHALL still build the follow-up's prompt from the full ancestor chain regardless of sharing, so runs and regenerations are unaffected
- **AND** viewers who can no longer see the parent SHALL see a "currently not visible" placeholder in place of the history, while the follow-up's own question, inputs, and answers display normally

#### Scenario: Follow-up pins one of several answers
- **WHEN** the parent entry has answers from multiple models and the user follows up on one of them
- **THEN** the child's history SHALL use exactly that answer

### Requirement: PDF entry points for selection and screenshot asking
For an authenticated user viewing a paper PDF, the selection toolbar SHALL offer 提问 for the current passage, and region capture SHALL offer 截图提问 alongside copying the screenshot link. Asking directly SHALL NOT prompt for a question: it SHALL submit immediately with the question set to the input's reference token followed by the preset question configured in `config.yml`, and SHALL show the input (passage or thumbnail) with the streamed answer rendered as Markdown with LaTeX in a panel near the selection. Asking directly SHALL show the same doc2x-not-ready confirmation as other Q&A asks before submitting. A passage selection MAY span several pages; its input SHALL then record one page/offset segment per page and present its pages as a range. Anonymous users SHALL NOT see these actions.

#### Scenario: Ask about a selected passage
- **WHEN** an authenticated user selects a paragraph and clicks 提问
- **THEN** without asking for any text, a free Q&A entry SHALL be created with that passage as `Quote1` and question `@Quote1 Explain this in detail in an easy-to-understand way, using bullet points.` (the configured preset question), answered by the configured default model only, and its answer SHALL stream into the panel

#### Scenario: Cross-page passage
- **WHEN** an authenticated user selects a paragraph that continues from page 3 onto page 4 and clicks 提问
- **THEN** the `Quote1` input SHALL contain the concatenated text with segments for pages 3 and 4, and the model input SHALL label it with pages 3–4

#### Scenario: Direct ask before doc2x parsing finishes
- **WHEN** the paper can currently only use mechanically extracted text and doc2x parsing has not finished
- **THEN** clicking 提问 SHALL first show the doc2x-not-ready confirmation and SHALL submit only after the user confirms

#### Scenario: Ask about a screenshot
- **WHEN** an authenticated user drags a region in capture mode and chooses 截图提问
- **THEN** the region image SHALL be uploaded to the image host and a free Q&A entry with that image input SHALL be created

### Requirement: Contextual questions follow the qa sharing switch
Selection, screenshot, and follow-up entries SHALL be free Q&A owned by the asker and SHALL follow the owner's `qa` sharing switch and the shared mine/all rules; no separate switch SHALL exist.

#### Scenario: Unshared contextual question hidden
- **WHEN** the asker has turned `qa` sharing off
- **THEN** non-admin users SHALL NOT see the entry, and admins SHALL see it marked Private

### Requirement: Q&A list headers summarize inputs by category
In the collapsed Q&A list (the `/qa` feed and paper User Q&A), an entry header SHALL summarize its inputs only as one icon per input category with that category's count (selection, image, history). The header SHALL NOT render input contents, and conversation history content SHALL NOT be displayed in the collapsed list. Entries without inputs SHALL show no input summary.

#### Scenario: Mixed inputs summarized
- **WHEN** an entry has two selection inputs, one image input, and one history input
- **THEN** its collapsed header SHALL show the selection icon with 2, the image icon with 1, and the history icon with 1

#### Scenario: History not expanded in list
- **WHEN** a follow-up entry is shown collapsed in the Q&A list
- **THEN** only the history icon and count SHALL appear, not the previous questions or answers

#### Scenario: Plain question has no summary
- **WHEN** an entry has no inputs
- **THEN** no input icons SHALL be shown in its header

### Requirement: Q&A deletion is soft
Deleting a Q&A answer SHALL mark it deleted instead of removing it. Deleted answers SHALL be excluded from every user-facing read (lists, details, streams, counts), while the backend SHALL still read them when building a follow-up's conversation history.

#### Scenario: Deleted answer hidden
- **WHEN** an owner deletes an answer
- **THEN** it SHALL no longer appear in any Q&A list or detail view for any user

#### Scenario: Follow-up survives parent deletion
- **WHEN** the answer a follow-up continues from is deleted
- **THEN** the follow-up SHALL still run and regenerate with the full history, and viewers SHALL see a "deleted" placeholder in place of that history

### Requirement: Every Q&A has a global ID and cross-paper link
Every Q&A entry, preset or free, SHALL be identified by a site-wide unique ID that never changes or gets reused, shown as `QA-<id>`; in the paper page's Q&A list the collapsed entry header SHALL show `QA-<id>` as its right-most element and SHALL NOT show a model-name or answer-count badge. Generated Q&A links SHALL take the form `paperland://paper/<paperId>?qa=<entryId>` with optional `&result=<resultId>`, always including the owning paper id. When resolving such a link, the system SHALL locate the target solely by `qa` (and `result`), opening whichever paper actually owns the entry, regardless of the `paperId` in the link.

#### Scenario: Cross-paper reference
- **WHEN** a user clicks `paperland://paper/7?qa=42&result=99` in a note about another paper
- **THEN** the app SHALL navigate to the paper owning entry 42 and locate result 99

#### Scenario: Paper id in link does not matter for resolution
- **WHEN** a link's `paperId` does not match the paper that owns entry 42
- **THEN** the app SHALL still open the paper that owns entry 42 and locate it without error

#### Scenario: Generated link includes paper id
- **WHEN** a user copies the reference of entry 42 belonging to paper 7
- **THEN** the copied link SHALL be `paperland://paper/7?qa=42`

#### Scenario: Reference to unavailable Q&A
- **WHEN** the referenced Q&A is not visible to the viewer or has been deleted
- **THEN** the app SHALL show a "not visible" or "deleted" message without revealing its content

### Requirement: Question box accepts multiple labeled attachments
The Q&A question box SHALL accept any number of passage and screenshot attachments added from the PDF via an "add to question box" action, in addition to asking directly from a single selection or screenshot. Attachments SHALL be listed above the text input in insertion order, each with its category icon, a per-category English label (`@Image1`, `@Quote2`), a short preview, and its page, and SHALL be removable. The number of attachments SHALL NOT be limited. The draft (question text, attachments with their labels, and the chosen parent answer) SHALL survive a page reload for the same user and paper, and SHALL be cleared after a successful submit.

#### Scenario: Collect several inputs before asking
- **WHEN** a user adds two passages and one screenshot to the question box, types a question, and submits
- **THEN** one entry SHALL be created whose inputs contain all three attachments in order with their labels and page metadata

#### Scenario: Draft survives reload
- **WHEN** a user has added a screenshot and a passage and typed part of a question, then reloads the page
- **THEN** the question box SHALL restore the text and both attachments with the same labels

#### Scenario: Labels stay stable on removal
- **WHEN** a user removes `@Quote1` after adding `@Quote1` and `@Quote2`
- **THEN** `@Quote2` SHALL keep its label, and `@Quote1` tokens SHALL be removed from the question text

### Requirement: Attachment references in question text
Adding an attachment SHALL insert its `@`-prefixed English reference token (e.g. `@Image1`, `@Quote1`) at the current cursor position in the question text. Tokens MAY be repeated or inserted through a completion menu opened by typing `@`. The question SHALL be stored with its tokens unchanged; page and other metadata SHALL NOT be added to the question text but SHALL be given with each input when the backend assembles the model input.

#### Scenario: Token inserted at cursor
- **WHEN** the cursor is in the middle of the question text and the user adds a screenshot labeled `@Image1`
- **THEN** `@Image1` SHALL be inserted at the cursor position

#### Scenario: Model sees labeled inputs
- **WHEN** an entry with inputs labeled `@Quote1` and `@Image1` runs
- **THEN** the model input SHALL present images, then quotes, each with its label and page, followed by history and then the question text

### Requirement: Follow-ups can reference earlier inputs without re-adding them
Labels SHALL be unique and stable across a whole conversation chain; inputs added in a follow-up SHALL continue each category's numbering. In a follow-up, the completion menu SHALL list inputs from all ancestor turns, and referencing one SHALL NOT require uploading or attaching it again. When assembling the model input, the backend SHALL include every image and quote of the whole chain exactly once in the inputs section, and the history section SHALL refer to them only by label without resending their content. Instructions used by earlier turns SHALL NOT be repeated in the history; only the current entry's instruction SHALL be sent.

#### Scenario: Reference an earlier screenshot
- **WHEN** the root question attached `@Image1` and a follow-up question mentions `@Image1` without attaching anything
- **THEN** the follow-up SHALL be created without new inputs, and the model input SHALL include `@Image1` once in the inputs section while history mentions it only as `@Image1`

#### Scenario: Numbering continues in follow-up
- **WHEN** the root used `@Image1` and a follow-up attaches a new screenshot
- **THEN** the new screenshot SHALL be labeled `@Image2`

### Requirement: Default parent answer for follow-ups is the most recently requested one
When a follow-up is started on a specific answer (for example from that answer's tab in the expanded Q&A list), it SHALL continue from that answer. Only completed answers SHALL be eligible as a follow-up's parent; queued, streaming, failed, cancelled, or deleted answers SHALL NOT be. When no answer is chosen, it SHALL continue from the entry's latest completed answer, where latest SHALL be determined by the time the answer was requested (created), not completed, with the result id as tiebreaker. When one submission requests several models, their answers SHALL be created in reverse order of the model selection list, so the first-listed model's answer is the latest.

#### Scenario: Follow-up from a chosen answer
- **WHEN** the user follows up while viewing the second model's answer tab
- **THEN** the follow-up SHALL continue from that answer

#### Scenario: Default to latest requested answer
- **WHEN** an entry has an answer requested at 10:00 that finished at 10:05 and another requested at 10:01 that finished at 10:02, and the user follows up without choosing
- **THEN** the follow-up SHALL continue from the answer requested at 10:01

#### Scenario: Unfinished or failed answer cannot be followed up
- **WHEN** an answer is still streaming or has failed
- **THEN** the follow-up action SHALL be unavailable for it, and the backend SHALL reject a follow-up referencing it with 409

#### Scenario: Default skips unfinished answers
- **WHEN** an entry's most recently requested answer is still streaming and an older answer is completed
- **THEN** a follow-up without an explicit choice SHALL continue from the completed answer

#### Scenario: First-listed model is latest in a multi-model submission
- **WHEN** a user submits one question with models A, B, C selected in that list order
- **THEN** the answers SHALL be created in the order C, B, A, and A's answer SHALL be the default for follow-ups

### Requirement: Default selected answer tab is the most recently requested one
When a Q&A entry with several answers is displayed (paper User Q&A and the `/qa` feed), the answer tab selected by default SHALL be the most recently requested answer, ordered by Result creation time with the result id as tiebreaker, regardless of when each answer completed and regardless of its status. A newly created run SHALL still become the selected tab immediately.

#### Scenario: Earlier-finished later-requested answer is shown
- **WHEN** an entry has an answer requested at 10:00 that finished at 10:05 and another requested at 10:01 that finished at 10:02
- **THEN** the answer requested at 10:01 SHALL be selected by default

#### Scenario: First-listed model shown by default
- **WHEN** a user submits one question with models A, B, C in that list order
- **THEN** A's answer SHALL be the default selected tab

### Requirement: Named system prompts separate rules from paper content
System prompts SHALL be stored as individual files in a prompts directory configured in `config.yml`, each file's name (without extension) being the system prompt's name; `config.yml` SHALL name the default system prompt, while its `qa` list SHALL only define preset questions. Each run SHALL read the file's current content, so editing a system prompt file SHALL take effect without restarting. A system prompt SHALL contain only answering rules and SHALL be sent as the model's system content; the paper text, inputs, history, and question SHALL be placed in the user content by the backend, not through placeholders in a config template. A preset question and the direct-ask action MAY name a system prompt; otherwise the default SHALL be used. Entries SHALL record the system prompt name.

#### Scenario: Paper is not in the system prompt
- **WHEN** any Q&A run is sent to a model
- **THEN** the system content SHALL be the selected system prompt text only, and the paper text SHALL appear in the user content

#### Scenario: Preset question selects its own system prompt
- **WHEN** a preset question in `qa` names system prompt `kid-friendly`
- **THEN** its runs SHALL use `kid-friendly` as system content while other questions use the default

#### Scenario: Unknown system prompt name rejected at startup
- **WHEN** a preset question or `direct_ask` names a system prompt that is not defined
- **THEN** config loading SHALL fail with an error naming the missing system prompt file

#### Scenario: Editing a system prompt file takes effect without restart
- **WHEN** an administrator edits `prompts/system/paper-qa.md` while the server is running
- **THEN** the next Q&A run using `paper-qa` SHALL use the edited text

#### Scenario: Legacy system_prompt key rejected
- **WHEN** `config.yml` still contains the top-level `system_prompt` key
- **THEN** config loading SHALL fail with an error stating that `system_prompt` is deprecated and pointing to the system prompt files and `qa_prompt.default_system_prompt`

### Requirement: Suggested follow-ups apply to every Q&A answer
The default system prompt SHALL ask the model to end every answer with three numbered follow-up questions formatted as `[💬 question](#moonlight)`, for preset and free Q&A alike, and such links SHALL open a pre-filled follow-up in every Q&A answer view.

#### Scenario: Preset answer offers follow-ups
- **WHEN** a user views the answer to a preset question such as `summary`
- **THEN** it SHALL end with three suggested follow-up links, and clicking one SHALL open a follow-up pre-filled with that question

### Requirement: Cited references are provided and citation links are constrained
When the paper has Semantic Scholar reference data, the user content SHALL include a `<references>` section, placed after the paper text and before the inputs, listing only the papers this paper cites (never papers citing it). Each entry SHALL give a citation id (the Semantic Scholar paperId, or a `no id` marker when unknown), title, first author, year, and venue, and SHALL be marked with its in-app link when the paper is in the library. The default system prompt SHALL require `[short title](#cite:<id>)` links to use only ids copied from `<references>` or from the model's own search results and SHALL forbid inventing ids. Web search SHALL be offered only to Codex models.

#### Scenario: Only cited papers are listed
- **WHEN** a paper has both references and citing papers stored
- **THEN** the `<references>` section SHALL contain only the papers it cites

#### Scenario: Citation link to a listed reference
- **WHEN** an answer contains `#cite:<id>` whose id is in the paper's references
- **THEN** the answer view SHALL render a dedicated citation element using the stored reference data

#### Scenario: Citation link with an unknown id
- **WHEN** an answer contains `#cite:<id>` whose id is not in the paper's references
- **THEN** the answer view SHALL render only the link text as plain text

#### Scenario: Unknown citation ids are stored
- **WHEN** an answer finishes and contains `#cite:<id>` links whose ids are not in the paper's references
- **THEN** each such id SHALL be stored once per answer with its link text and id kind, for later resolution

#### Scenario: Library paper link
- **WHEN** a listed reference is also a paper in the library
- **THEN** the entry SHALL carry its `paperland://paper/<id>` link so the model can link to it

### Requirement: Model input can be viewed on demand as a current rebuild
Users who can see an answer SHALL be able to request a view of the model input for it. The input SHALL NOT be stored; on request the backend SHALL rebuild it with the same formatter used for runs, from the current system prompt file, paper content, references, inputs, history, and question, without attempting to reproduce what was sent when the answer was produced. The paper section SHALL be summarized (source and length) instead of returning the full text. The view SHALL NOT be loaded until requested and SHALL state that it is rebuilt from the current configuration.

#### Scenario: View model input on demand
- **WHEN** a user clicks "view model input" under an answer
- **THEN** the frontend SHALL request it then, and display the system prompt, a one-line paper summary, and the references, inputs, history, and question sections

#### Scenario: Old answer uses current rules
- **WHEN** a user views the model input of an answer created before the system prompt changed
- **THEN** the view SHALL show the input rebuilt with the current system prompt and SHALL note it may differ from what was originally sent

#### Scenario: Full text not returned
- **WHEN** the model input is requested
- **THEN** the response SHALL contain the paper's content source and length but not its full text

### Requirement: Follow-up trees can be read
The backend SHALL provide a read of the whole follow-up tree containing a given entry, returning each node's entry, its non-deleted answers, and the parent answer it continues from, with nodes the viewer cannot see or that were deleted returned only as placeholders.

#### Scenario: Read a tree from a follow-up
- **WHEN** a client requests the tree of a follow-up entry two levels deep
- **THEN** the response SHALL start at the root entry and include every descendant with its parent answer id

#### Scenario: Hidden node in a tree
- **WHEN** a node in the tree belongs to a user whose `qa` sharing is off and the viewer is not that user
- **THEN** that node SHALL be returned only as a "currently not visible" placeholder without its content

### Requirement: Image inputs live in the built-in image host
Every image input SHALL reference an image stored in the application's own image host. Clients SHALL upload images (screenshots, and any pasted or dropped images) to the image host before submitting, and the backend SHALL reject an image input that does not reference an existing image-host record, including external or data URLs, with 400. Image inputs SHALL reference the image by its image-host hash.

#### Scenario: External image URL rejected
- **WHEN** a client submits an image input whose source is an external URL rather than an image-host record
- **THEN** the request SHALL be rejected with 400 and no entry SHALL be created

#### Scenario: Follow-up long after the screenshot
- **WHEN** a user follows up months later on a Q&A whose root used a screenshot
- **THEN** the screenshot SHALL still be read from the image host and sent to the model
