import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const MAX_SOURCE_CHARS = 5_000;

function isPublicWebUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    return hostname !== 'localhost' && hostname !== '::1' && !hostname.startsWith('127.') && !hostname.startsWith('10.') && !hostname.startsWith('192.168.') && !hostname.startsWith('169.254.') && !hostname.endsWith('.local');
  } catch {
    return false;
  }
}

function cleanText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

function pageTitle(html: string, fallback: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] ?? '').slice(0, 120) || fallback;
}

function cleanReaderText(value: string) {
  return value
    .replace(/^Title:\s*.*$/gim, '')
    .replace(/^URL Source:\s*.*$/gim, '')
    .replace(/^Markdown Content:\s*$/gim, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

async function readDirect(urlText: string) {
  const response = await fetch(urlText, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (compatible; CourseMaster/1.0; learning-source reader)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`The website returned ${response.status}.`);
  if (!isPublicWebUrl(response.url)) throw new Error('That link redirected to an unsupported location.');
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    if (contentType.includes('pdf')) throw new Error('This is a PDF. Upload or paste its text for now; PDF reading is the next ingestion upgrade.');
    throw new Error('This link is a download or media file, not a readable web page.');
  }
  const html = (await response.text()).slice(0, 350_000);
  const sourceText = cleanText(html);
  if (sourceText.length < 120) throw new Error('There was not enough readable text on that page.');
  const finalUrl = new URL(response.url);
  return { label: pageTitle(html, finalUrl.hostname.replace(/^www\./, '')), url: finalUrl.toString(), sourceText, characterCount: sourceText.length, readerFallback: false };
}

async function readWithArticleReader(urlText: string) {
  const response = await fetch(`https://r.jina.ai/${urlText}`, { headers: { Accept: 'text/plain' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!response.ok) throw new Error('The page could not be read by the article reader.');
  const markdown = (await response.text()).slice(0, 350_000);
  const sourceText = cleanReaderText(markdown);
  if (sourceText.length < 120) throw new Error('There was not enough readable text on that page.');
  const title = markdown.match(/^Title:\s*(.+)$/im)?.[1]?.trim().slice(0, 120);
  const url = new URL(urlText);
  return { label: title || url.hostname.replace(/^www\./, ''), url: url.toString(), sourceText, characterCount: sourceText.length, readerFallback: true };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to ingest a source.' }, { status: 401 });
  let urlText = '';
  try {
    const body = await request.json() as { url?: unknown };
    urlText = typeof body.url === 'string' ? body.url.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Please send a valid web link.' }, { status: 400 });
  }
  if (!isPublicWebUrl(urlText)) return NextResponse.json({ error: 'Use a public http or https web link.' }, { status: 400 });

  try {
    return NextResponse.json(await readDirect(urlText));
  } catch (directError) {
    const directMessage = directError instanceof Error ? directError.message : 'The page blocked direct reading.';
    if (directMessage.includes('PDF') || directMessage.includes('download or media') || directMessage.includes('unsupported location')) return NextResponse.json({ error: directMessage }, { status: 422 });
    try {
      return NextResponse.json(await readWithArticleReader(urlText));
    } catch (readerError) {
      console.error('Web source ingestion failed', { directMessage, readerError });
      return NextResponse.json({ error: 'This page blocks reading or needs a sign-in. Try a public article, a direct text page, or paste the relevant notes.' }, { status: 422 });
    }
  }
}
