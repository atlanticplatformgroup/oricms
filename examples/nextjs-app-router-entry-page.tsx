import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createNextClient } from '@oricms/nextjs';

const cms = createNextClient({
  contentPath: process.env.ORICMS_REPO_PATH || './oricms-repo',
});

const COLLECTION_ID = 'posts';

type PageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  const entries = await cms.getCollection(COLLECTION_ID, { preview: false });

  return entries
    .map((entry) => entry.metadata.slug)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const entry = await cms.getEntry(COLLECTION_ID, params.slug, {
    preview: false,
  });

  if (!entry) {
    return {};
  }

  return {
    title: entry.metadata.title,
    description:
      typeof entry.metadata.description === 'string'
        ? entry.metadata.description
        : undefined,
  };
}

export default async function BlogEntryPage({ params }: PageProps) {
  const entry = await cms.getEntry(COLLECTION_ID, params.slug, {
    preview: false,
  });

  if (!entry) {
    notFound();
  }

  return (
    <article>
      <header>
        <h1>{entry.metadata.title}</h1>
        {typeof entry.metadata.description === 'string' ? (
          <p>{entry.metadata.description}</p>
        ) : null}
      </header>

      {typeof entry.content === 'string' && entry.content.trim() ? (
        <section>
          <pre>{entry.content}</pre>
        </section>
      ) : null}
    </article>
  );
}
