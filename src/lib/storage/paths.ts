/** Every storage path is namespaced `{organisationId}/...` — this prefix is
 * exactly what the storage RLS policies (0007_storage.sql) check against
 * organisation_members, so it must never be constructed any other way. */

const MIME_TO_EXT: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
};

/** Derives a clean file extension from a mime type — a naive
 * `mimeType.split("/")[1]` turns `image/svg+xml` into the wrong
 * `svg+xml`, so known-irregular ones are mapped explicitly. */
export function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXT[mimeType] ?? mimeType.split("/")[1]?.split("+")[0] ?? "png";
}

export function generatedImagePath(organisationId: string, campaignId: string, assetId: string, ext: string) {
  return `${organisationId}/${campaignId}/${assetId}.${ext}`;
}

export function brandAssetPath(organisationId: string, brandId: string, assetId: string, fileName: string) {
  return `${organisationId}/${brandId}/${assetId}-${fileName}`;
}

export function knowledgeDocumentPath(organisationId: string, documentId: string, fileName: string) {
  return `${organisationId}/${documentId}-${fileName}`;
}

export function referenceImagePath(organisationId: string, campaignId: string, fileName: string) {
  return `${organisationId}/${campaignId}/${Date.now()}-${fileName}`;
}
