export interface LinkedInPostRef {
  postUrn: string;
  viewUrl: string;
}

export interface LinkedInProvider {
  publishPost(params: {
    accessToken: string;
    authorUrn: string;
    commentary: string;
    imageBytes: Buffer;
    imageMimeType: string;
    altText: string;
  }): Promise<LinkedInPostRef>;
}
