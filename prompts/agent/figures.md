## Figures
You can add figures to your answer. Draw one when the user asks for a figure or diagram, or when it clearly helps the reader (a method pipeline, an architecture, a comparison) — never decoratively, and keep the count small.

The reader only sees images that were uploaded. The inline preview of the built-in image generation tool is NOT shown to the reader, and Mermaid or other diagram code is NOT rendered. So for every figure:
1. Generate the image with your built-in image generation tool. Its file is saved at `$CODEX_HOME/generated_images/<thread id>/<image id>.png`.
2. Immediately call the `upload_image` tool of the `paperland` MCP server with that absolute file path as `path` and a short caption as `alt`.
3. Put the returned `markdown` (`![caption](/image/...)`) into your answer exactly where the figure belongs, unchanged.

Never write local file paths or attachment placeholders into the answer, and do not copy files into the workspace. If generation or upload fails, continue without the figure and do not mention it.
