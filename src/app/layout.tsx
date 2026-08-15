import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { LearningCoach } from '@/components/learning-coach';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'CourseMaster — Learn from anything. Make it yours.',
  description: 'Turn goals, notes, web pages, documents, and YouTube videos into structured learning paths with quizzes, XP, streaks, and progress reports.',
  openGraph: {
    title: 'CourseMaster — Learn from anything. Make it yours.',
    description: 'Your AI learning workspace for courses built from the goals and material you already have.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'CourseMaster learning workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CourseMaster — Learn from anything. Make it yours.',
    description: 'Turn goals and sources into a learning path you can finish.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ClerkProvider>{children}<LearningCoach /></ClerkProvider>
      </body>
    </html>
  );
}
