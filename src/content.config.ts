import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tag: z.string(),
    date: z.coerce.date(),
    dateDisplay: z.string(),
    readTime: z.string(),
    body: z.string(),
  }),
});

export const collections = { posts };