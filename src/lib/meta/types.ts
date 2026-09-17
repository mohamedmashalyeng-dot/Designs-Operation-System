export interface MetaPostRef {
  externalPostId: string;
  viewUrl: string;
}

export interface MetaProvider {
  publishToFacebookPage(params: { pageId: string; pageAccessToken: string; caption: string; imageUrl: string }): Promise<MetaPostRef>;
  publishToInstagram(params: {
    instagramUserId: string;
    pageAccessToken: string;
    caption: string;
    imageUrl: string;
  }): Promise<MetaPostRef>;
}
