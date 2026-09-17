import "server-only";
import type { CanvaDesignRef, CanvaProvider } from "./types";

/**
 * Real implementation against the documented Canva Connect API endpoints
 * (verified 2026-09-17). Design links are nested under design.urls in
 * the Create design response, as documented at:
 * https://www.canva.dev/docs/connect/api-reference/designs/create-design/
 */

const API_BASE = "https://api.canva.com/rest/v1";

interface CanvaJob<T> {
  id: string;
  status: "in_progress" | "success" | "failed";
  error?: { code: string; message: string };
  // Present once status === "success"; field name varies per endpoint.
  [key: string]: unknown;
  result?: T;
}

async function pollJob<T>(
  fetchJob: () => Promise<{ job: CanvaJob<T> }>,
  { timeoutMs = 30_000, intervalMs = 1500 } = {}
): Promise<CanvaJob<T>> {
  const start = Date.now();
  let { job } = await fetchJob();
  while (job.status === "in_progress") {
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timed out waiting for Canva to finish processing");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    ({ job } = await fetchJob());
  }
  if (job.status === "failed") {
    throw new Error(`Canva job failed: ${job.error?.message ?? "unknown error"} (${job.error?.code ?? "no code"})`);
  }
  return job;
}

async function uploadAsset(params: {
  accessToken: string;
  imageBytes: Buffer;
  fileName: string;
}): Promise<string> {
  const metadata = JSON.stringify({ name_base64: Buffer.from(params.fileName.slice(0, 50)).toString("base64") });

  const createResponse = await fetch(`${API_BASE}/asset-uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": metadata,
    },
    body: new Uint8Array(params.imageBytes),
  });
  if (!createResponse.ok) {
    throw new Error(`Canva asset upload failed (${createResponse.status}): ${await createResponse.text()}`);
  }
  const created = (await createResponse.json()) as { job: CanvaJob<unknown> };
  const jobId = created.job.id;

  const job = await pollJob(async () => {
    const res = await fetch(`${API_BASE}/asset-uploads/${jobId}`, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) throw new Error(`Failed to poll Canva asset upload job (${res.status})`);
    return (await res.json()) as { job: CanvaJob<unknown> };
  });

  const asset = job.asset as { id: string } | undefined;
  if (!asset?.id) throw new Error("Canva asset upload succeeded but returned no asset id");
  return asset.id;
}

export class CanvaConnectProvider implements CanvaProvider {
  async createDesignFromImage(params: {
    accessToken: string;
    imageBytes: Buffer;
    mimeType: string;
    fileName: string;
    title: string;
  }): Promise<CanvaDesignRef> {
    const assetId = await uploadAsset({
      accessToken: params.accessToken,
      imageBytes: params.imageBytes,
      fileName: params.fileName,
    });

    const response = await fetch(`${API_BASE}/designs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        design_type: { type: "custom", width: 1024, height: 1024 },
        asset_id: assetId,
        title: params.title.slice(0, 255),
      }),
    });
    if (!response.ok) {
      throw new Error(`Canva design creation failed (${response.status}): ${await response.text()}`);
    }

    const { design } = (await response.json()) as {
      design?: {
        id: string;
        urls?: { edit_url: string; view_url: string };
        thumbnail?: { url: string };
      };
    };
    if (!design?.id || !design.urls?.edit_url || !design.urls.view_url) {
      throw new Error("Canva created the design but returned no editing or viewing URL");
    }

    return {
      designId: design.id,
      editUrl: design.urls.edit_url,
      viewUrl: design.urls.view_url,
      thumbnailUrl: design.thumbnail?.url ?? null,
    };
  }

  async exportDesignAsPng(params: { accessToken: string; designId: string }): Promise<{ url: string }> {
    const createResponse = await fetch(`${API_BASE}/exports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        design_id: params.designId,
        format: { type: "png", width: 1024, height: 1024, lossless: true },
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Canva export request failed (${createResponse.status}): ${await createResponse.text()}`);
    }
    const created = (await createResponse.json()) as { job: CanvaJob<unknown> };
    const jobId = created.job.id;

    const job = await pollJob(async () => {
      const res = await fetch(`${API_BASE}/exports/${jobId}`, {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      });
      if (!res.ok) throw new Error(`Failed to poll Canva export job (${res.status})`);
      return (await res.json()) as { job: CanvaJob<unknown> };
    });

    const urls = job.urls as string[] | undefined;
    if (!urls?.length) throw new Error("Canva export succeeded but returned no download URL");
    return { url: urls[0] };
  }
}
