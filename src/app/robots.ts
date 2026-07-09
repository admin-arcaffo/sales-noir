import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/conversations/',
        '/leads/',
        '/settings/',
        '/checkout/',
        '/invite/',
        '/tasks/',
      ],
    },
    sitemap: 'https://dealeto.arcaffo.com/sitemap.xml',
  };
}
