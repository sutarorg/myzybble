import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogPost from "@/views/blog/BlogPost";
import { POSTS } from "@/data/posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return { title: "Post not found" };
  return { title: `${post.title} — zybble`, description: post.excerpt, openGraph: { title: post.title, description: post.excerpt, type: "article" } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!POSTS.some((p) => p.slug === slug)) notFound();
  return <BlogPost slug={slug} />;
}
