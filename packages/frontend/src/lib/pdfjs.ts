// Lazy bootstrap for pdf.js.
//
// The heavy `pdfjs-dist` library is loaded via a dynamic `import()` so Vite
// code-splits it out of the main bundle — it is only fetched when a PDF tab is
// actually opened. The worker is imported as a URL (Vite emits it as an asset)
// and registered on `GlobalWorkerOptions` the first time the library loads.
//
// The version is pinned in package.json: PDF anchor offsets (`ts`/`te`) are
// character offsets into pdf.js's extracted text content, which must stay
// stable across the deployed version for old links to keep resolving.
import type * as PdfjsModule from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let pdfjsPromise: Promise<typeof PdfjsModule> | null = null

/** Load pdf.js once and ensure its worker is configured. */
export function loadPdfjs(): Promise<typeof PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })
  }
  return pdfjsPromise
}
