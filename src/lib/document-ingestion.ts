export const MAX_DOCUMENT_BYTES = 50_000_000;
export const MAX_DOCUMENT_MB = Math.round(MAX_DOCUMENT_BYTES / 1_000_000);
export const DOCUMENT_ACCEPT = '.txt,.md,.csv,.json,.pdf,.docx,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const MAX_DOCUMENT_CONTEXT = 16_000;
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json']);

function extensionOf(file: File) {
  return file.name.split('.').pop()?.trim().toLowerCase() || '';
}

function isPdf(file: File) {
  return extensionOf(file) === 'pdf' || file.type === 'application/pdf';
}

function isDocx(file: File) {
  return extensionOf(file) === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function isTextDocument(file: File) {
  return TEXT_EXTENSIONS.has(extensionOf(file)) || ['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(file.type);
}

export function documentContext(text: string) {
  const clean = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
  if (clean.length <= MAX_DOCUMENT_CONTEXT) return clean;

  const chunkCount = 8;
  const chunkLength = Math.floor((MAX_DOCUMENT_CONTEXT - 500) / chunkCount);
  const distance = Math.max(1, Math.floor((clean.length - chunkLength) / (chunkCount - 1)));
  const excerpts = Array.from({ length: chunkCount }, (_, index) => {
    const start = Math.min(index * distance, clean.length - chunkLength);
    return `[Document excerpt ${index + 1} of ${chunkCount}]\n${clean.slice(start, start + chunkLength)}`;
  });
  return `${excerpts.join('\n\n')}\n\n[The full document was longer; these excerpts were selected across it.]`;
}

async function extractPdfText(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pageCount = Math.min(document.numPages, 400);
  const pages = Array.from({ length: pageCount }, (_, index) => pageCount === 1 ? 1 : Math.round((index * (document.numPages - 1)) / (pageCount - 1)) + 1);
  const pageText: string[] = [];

  for (const pageNumber of pages) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => 'str' in item ? item.str : '').join(' ');
    if (text.trim()) pageText.push(`[Page ${pageNumber}]\n${text}`);
  }
  await document.destroy();
  return pageText.join('\n\n');
}

async function extractDocxText(file: File) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function readDocument(file: File) {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(`Choose a document smaller than ${MAX_DOCUMENT_MB} MB.`);
  }

  if (isTextDocument(file)) return documentContext(await file.text());
  if (isPdf(file)) return documentContext(await extractPdfText(file));
  if (isDocx(file)) return documentContext(await extractDocxText(file));

  throw new Error('Choose a PDF, Word .docx, or text document.');
}
