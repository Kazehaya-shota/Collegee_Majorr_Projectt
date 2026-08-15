import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type OpenverseImage = { thumbnail?: string; title?: string; creator?: string; license?: string; license_version?: string; license_url?: string; foreign_landing_url?: string };
type YouTubeItem = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } } };

function searchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Sign in to load learning resources.' }, { status: 401 });

  try {
    const { moduleId } = await params;
    const supabase = createSupabaseAdminClient();
    const { data: module, error: moduleError } = await supabase.from('course_modules').select('id, course_id, title, description').eq('id', moduleId).maybeSingle();
    if (moduleError) throw moduleError;
    if (!module) return NextResponse.json({ error: 'Module not found.' }, { status: 404 });
    const { data: course, error: courseError } = await supabase.from('courses').select('topic').eq('id', module.course_id).eq('owner_id', userId).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return NextResponse.json({ error: 'You cannot load these resources.' }, { status: 403 });

    const query = `${course.topic} ${module.title}`.slice(0, 180);
    const blogQuery = `${query} tutorial explained`;
    const [imageResult, videoResult] = await Promise.allSettled([
      fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=3&mature=false&license=by,by-sa,pdm`, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 } }).then((response) => response.ok ? response.json() as Promise<{ results?: OpenverseImage[] }> : { results: [] }),
      process.env.YOUTUBE_API_KEY
        ? fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=3&q=${encodeURIComponent(query)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY)}`, { next: { revalidate: 3600 } }).then((response) => response.ok ? response.json() as Promise<{ items?: YouTubeItem[] }> : { items: [] })
        : Promise.resolve({ items: [] as YouTubeItem[] }),
    ]);

    const rawImages = imageResult.status === 'fulfilled' ? imageResult.value.results ?? [] : [];
    const images = rawImages.filter((image) => image.thumbnail?.startsWith('http')).slice(0, 3).map((image) => ({ imageUrl: image.thumbnail!, title: image.title?.trim() || 'Open learning visual', creator: image.creator?.trim() || 'Openverse contributor', license: [image.license?.toUpperCase(), image.license_version].filter(Boolean).join(' ') || 'Open licence', licenseUrl: image.license_url ?? null, sourceUrl: image.foreign_landing_url ?? null }));

    const rawVideos = videoResult.status === 'fulfilled' ? videoResult.value.items ?? [] : [];
    const videos = rawVideos.filter((item) => item.id?.videoId && item.snippet?.title).slice(0, 3).map((item) => ({ title: item.snippet!.title!, channel: item.snippet!.channelTitle || 'YouTube', thumbnail: item.snippet!.thumbnails?.high?.url || item.snippet!.thumbnails?.medium?.url || null, url: `https://www.youtube.com/watch?v=${item.id!.videoId}` }));

    return NextResponse.json({ query, images, videos, fallbackVideoSearch: searchUrl(`${query} tutorial`), blogs: [
      { title: `Find clear guides on ${module.title}`, description: 'Read practitioner explanations and tutorials that match this module.', url: `https://www.google.com/search?q=${encodeURIComponent(blogQuery)}` },
      { title: `Explore examples for ${course.topic}`, description: 'See applied examples to connect the concept with real use cases.', url: `https://www.google.com/search?q=${encodeURIComponent(`${query} examples`)}` },
    ] });
  } catch (error) {
    console.error('Learning resources failed', error);
    return NextResponse.json({ error: 'We could not load extra resources right now.' }, { status: 500 });
  }
}
