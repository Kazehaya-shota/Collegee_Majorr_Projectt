import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

type VideoSnippet = { title?: string; description?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } };
type VideoItem = { id?: string; snippet?: VideoSnippet; contentDetails?: { duration?: string } };
type PlaylistItem = { snippet?: VideoSnippet & { resourceId?: { videoId?: string } } };

function parseYouTubeUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(hostname)) throw new Error('Use a public YouTube video or playlist link.');
  const playlistId = url.searchParams.get('list');
  const videoId = hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : url.searchParams.get('v') ?? (url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? null);
  if (playlistId) return { kind: 'playlist' as const, id: playlistId, url: url.toString() };
  if (videoId) return { kind: 'video' as const, id: videoId, url: url.toString() };
  throw new Error('We could not find a YouTube video or playlist in that link.');
}

function text(value: unknown, fallback: string, limit: number) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
}

function duration(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const parts = [[match[1], 'h'], [match[2], 'm'], [match[3], 's']].filter(([amount]) => amount).map(([amount, label]) => `${amount}${label}`);
  return parts.join(' ') || null;
}

function image(snippet: VideoSnippet | undefined) {
  return snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || null;
}

function apiUrl(resource: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `https://www.googleapis.com/youtube/v3/${resource}?${search.toString()}`;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to use YouTube to Course.' }, { status: 401 });
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'YouTube is not configured yet. Add YOUTUBE_API_KEY to .env.local and restart the app.' }, { status: 503 });
  let input: { kind: 'video' | 'playlist'; id: string; url: string };
  try {
    const body = await request.json() as { url?: unknown };
    input = parseYouTubeUrl(typeof body.url === 'string' ? body.url.trim() : '');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Use a public YouTube link.' }, { status: 400 });
  }

  try {
    if (input.kind === 'video') {
      const response = await fetch(apiUrl('videos', { part: 'snippet,contentDetails', id: input.id, key: apiKey }), { next: { revalidate: 3600 } });
      const data = await response.json() as { items?: VideoItem[]; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'YouTube could not read this video.');
      const video = data.items?.[0];
      if (!video?.id || !video.snippet) return NextResponse.json({ error: 'That video is private, unavailable, or could not be found.' }, { status: 404 });
      const title = text(video.snippet.title, 'YouTube video', 140);
      const description = text(video.snippet.description, 'No public description was provided for this video.', 12_000);
      const channel = text(video.snippet.channelTitle, 'YouTube creator', 140);
      const sourceText = `YouTube video course source\nTitle: ${title}\nCreator: ${channel}\nDuration: ${duration(video.contentDetails?.duration) ?? 'Not provided'}\n\nPublic video description:\n${description}`;
      return NextResponse.json({ type: 'video', title, channel, thumbnail: image(video.snippet), videoCount: 1, source: { sourceType: 'link', label: title, url: `https://www.youtube.com/watch?v=${video.id}`, sourceText } });
    }

    const [playlistResponse, itemsResponse] = await Promise.all([
      fetch(apiUrl('playlists', { part: 'snippet', id: input.id, key: apiKey }), { next: { revalidate: 3600 } }),
      fetch(apiUrl('playlistItems', { part: 'snippet', playlistId: input.id, maxResults: '12', key: apiKey }), { next: { revalidate: 3600 } }),
    ]);
    const playlistData = await playlistResponse.json() as { items?: Array<{ snippet?: VideoSnippet }>; error?: { message?: string } };
    const itemsData = await itemsResponse.json() as { items?: PlaylistItem[]; error?: { message?: string } };
    if (!playlistResponse.ok || !itemsResponse.ok) throw new Error(playlistData.error?.message || itemsData.error?.message || 'YouTube could not read this playlist.');
    const playlist = playlistData.items?.[0]?.snippet;
    const videos = (itemsData.items ?? []).filter((item) => item.snippet?.resourceId?.videoId && item.snippet.title && item.snippet.title !== 'Private video').slice(0, 12);
    if (!playlist || !videos.length) return NextResponse.json({ error: 'That playlist is private, empty, or unavailable.' }, { status: 404 });
    const title = text(playlist.title, 'YouTube playlist', 140);
    const channel = text(playlist.channelTitle, 'YouTube creator', 140);
    const sourceText = `YouTube playlist course source\nPlaylist: ${title}\nCreator: ${channel}\n\nVideos in order:\n${videos.map((item, index) => `${index + 1}. ${text(item.snippet?.title, 'Video', 180)}\n${text(item.snippet?.description, 'No public description.', 2_000)}`).join('\n\n')}`.slice(0, 32_000);
    return NextResponse.json({ type: 'playlist', title, channel, thumbnail: image(playlist) || image(videos[0].snippet), videoCount: videos.length, source: { sourceType: 'link', label: title, url: `https://www.youtube.com/playlist?list=${input.id}`, sourceText } });
  } catch (error) {
    console.error('YouTube ingestion failed', error);
    const message = error instanceof Error ? error.message : 'YouTube could not read that link.';
    return NextResponse.json({ error: message.includes('API key') || message.includes('YouTube Data API') ? 'Your YouTube API key needs attention. Check that YouTube Data API v3 is enabled, then restart the app.' : 'We could not read that YouTube link. Make sure it is public and try again.' }, { status: 502 });
  }
}
