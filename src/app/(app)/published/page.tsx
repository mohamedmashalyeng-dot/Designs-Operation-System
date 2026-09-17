import type { Metadata } from "next";
import { Send, ExternalLink, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPublishedPosts } from "@/lib/publishing/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CHANNEL_LABELS } from "@/lib/constants/labels";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Published" };

export default async function PublishedPage() {
  const supabase = await createClient();
  const posts = await getPublishedPosts(supabase);

  return (
    <div className="space-y-8">
      <PageHeader title="Published" description="Everything published to connected channels through Creative Ops." />

      {posts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="flex flex-col overflow-hidden rounded-lg border">
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {post.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase Storage URL
                  <img src={post.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ImageIcon className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate text-sm font-medium">{post.designTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {CHANNEL_LABELS[post.channel]} · {formatDateTime(post.publishedAt)}
                </p>
                {post.externalUrl && (
                  <a
                    href={post.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-primary underline"
                  >
                    View live post <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Send}
          title="Nothing published yet"
          description="Connect a channel under Connections, then publish an approved creative from its review screen to see it here."
          className="py-24"
        />
      )}
    </div>
  );
}
