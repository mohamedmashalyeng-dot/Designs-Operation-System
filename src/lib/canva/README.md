# Connect Canva locally

1. Sign in to [Canva Developer Portal → Your integrations](https://www.canva.com/developers/integrations).
   Enable multi-factor authentication if Canva asks for it. Create an integration
   named `Designs Operation System`. Choose Public for development with a personal
   account; Private integrations require Canva Enterprise. Public distribution
   requires Canva review.
2. In Configuration, copy the Client ID and generate a Client secret. Save them
   directly in the project's `.env.local` file:

   ```dotenv
   CANVA_CLIENT_ID=
   CANVA_CLIENT_SECRET=
   CANVA_REDIRECT_URI=http://127.0.0.1:3000/api/connections/canva/callback
   NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
   ```

   Fill the first two values with your integration's credentials. Keep the secret
   in `.env.local`, which is excluded from Git. The example file stays blank.
3. Under Scopes, enable these four permissions:

   - `asset:read` — read the result of image uploads.
   - `asset:write` — upload generated images.
   - `design:content:read` — export edited designs back to the app.
   - `design:content:write` — create designs from the images.

4. Under Authentication → Authorized redirects, add exactly:

   ```text
   http://127.0.0.1:3000/api/connections/canva/callback
   ```

   Canva does not accept `localhost` as a redirect host. Use `127.0.0.1` for both
   the app and the callback so that the login and OAuth cookies are available.
5. Restart the app with `npm run dev` (`npm.cmd run dev` in Windows PowerShell).
   Open <http://127.0.0.1:3000/connections/canva>, sign in to the app if prompted,
   select **Connect Canva**, and approve access in Canva. The app saves the
   connection in the workspace's `connections` table in Supabase.

The Supabase migrations through `0006_connections_and_publishing.sql` and the
server's `SUPABASE_SERVICE_ROLE_KEY` must be configured to save the connection.

After connecting, use **Edit in Canva** on a generated creative. Return to the
app and use **Sync from Canva** to save the edited image as a new version.
Automatic return navigation still needs JWT signature verification; leave that
optional portal setting disabled for this workflow. Uploading an image does not
convert its text or artwork into separate editable Canva layers.

For a deployed app, replace both local URLs with the app's HTTPS domain and add
the exact callback URL to the integration's Authorized redirects.

References: [Creating integrations](https://www.canva.dev/docs/connect/creating-integrations/),
[Authentication](https://www.canva.dev/docs/connect/authentication/),
[Get asset upload job](https://www.canva.dev/docs/connect/api-reference/assets/get-asset-upload-job/).
