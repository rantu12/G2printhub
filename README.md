This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## G2 PrintHub authentication and store setup

Copy `.env.example` to `.env` only if you do not already have an `.env` file.
Keep `.env` private and never commit or share its credentials.

Required server-side environment variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and
  `AWS_REGION`: credentials and endpoint for Neon Object Storage model uploads.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token required for Admin image uploads, including the site logo.
- `RESEND_API_KEY`: Resend API key used only to send verification messages.
- `EMAIL_FROM`: sender address configured and verified with Resend.
- `APP_URL`: the canonical site origin, such as `http://localhost:3000` locally.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: OAuth web-client credentials.
- `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET`: server-side Cashfree PG credentials.
- `CASHFREE_ENVIRONMENT`: `sandbox` for testing (default) or `production`.
- `INTEGRATION_SECRETS_KEY`: 32 random bytes encoded as 64 hexadecimal characters; required to save encrypted integration overrides from Admin.

### Cashfree payments

Configure the Cashfree client ID and secret in the server environment; never
expose them in browser variables or commit real credentials. Use sandbox
credentials (Cashfree sandbox App IDs begin with `TEST`) with
`CASHFREE_ENVIRONMENT=sandbox` while testing. Admin integration settings also
require a separate confirmation before saving production credentials or
enabling live payments. Production requires live credentials and an HTTPS
`APP_URL`; sandbox credentials are rejected in production mode.

In the Cashfree dashboard, register
`https://YOUR_DOMAIN/api/payments/cashfree/webhook` for payment-success events.
The webhook signature is verified server-side, and the customer return page
also checks the order status directly with Cashfree before marking an order
paid. Enable Cashfree Payments in Admin → Settings after the server credentials
are configured. Cash on Delivery can be enabled or disabled separately.

The `/admin/settings` page also controls store identity, customer registration,
customer password login, Google sign-in, and the email-verification policy.
Those authentication policies are checked server-side; administrator sign-in
is not disabled by customer login settings. COD minimum/maximum amounts and an
optional fee are recalculated and enforced server-side when orders are placed.
The current checkout currency is INR only. Email delivery uses Resend; SMTP,
SMS, and third-party shipping APIs are not implemented.

GLB 3D models are uploaded directly from the Admin browser to the private Neon
Object Storage bucket using short-lived signed URLs. The app stores only the
object key in product/model records and issues temporary signed read URLs for
the admin and customer 3D previews. `neon.ts` declares the existing
`printhub-uploads` bucket as private; applying that configuration is a separate
Neon account action and is not run as part of local preparation. Locally, set
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and
`AWS_REGION` from the intended Neon branch. In Vercel, add them to the server
environment without exposing them as `NEXT_PUBLIC_*` values.

Before browser uploads and 3D previews can work, configure the bucket CORS
policy to allow the exact local and production site origins, `PUT` and `GET`
methods, and the `Content-Type` request header. Do not use a wildcard origin
for this private bucket. The bucket policy is not changed automatically by this
app.

### Email and Google setup

In Resend, add and verify the sender domain, publish the DNS records Resend
provides, and use an address on that verified domain for `EMAIL_FROM`. Email
delivery is not configured until a valid key and verified sender are supplied.

In Google Cloud Console:

1. Create or select a project and configure the OAuth consent screen.
2. Create an OAuth client ID of type **Web application**.
3. Add `http://localhost:3000/api/auth/google/callback` as an authorized
   redirect URI for local testing.
4. Add `https://YOUR_DOMAIN/api/auth/google/callback` for production and set
   `APP_URL` to that HTTPS origin.
5. Store the resulting client ID and secret in the corresponding environment
   variables. Do not publish the secret.

Use the provider's test-user restrictions while the consent screen is in test
mode. Production sign-in requires a correctly configured consent screen,
authorized redirect URI, and valid Google OAuth client credentials.

### Database and local checks

Apply the additive, data-preserving migration to the configured database with
`npx prisma migrate deploy`, then regenerate the Prisma client with
`npx prisma generate`. The migration marks existing accounts verified to
preserve their current sign-in access; newly registered password accounts
must verify their email. Do not run database reset commands.

The site identity settings include an optional WhatsApp contact number. Set it
under Admin → Settings → Site identity (include the country code) to show the
floating storefront chat button.

Create or promote the explicitly authorized admin account by setting
`ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and optionally
`ADMIN_NAME` in the process environment, then running
`npx tsx scripts/create-admin.ts`. The script does not print the email or
password.

Run `npm test`, `npm run lint`, `npx prisma validate`, and `npm run build`.
Start local development with `npm run dev`. Test email verification using a
Gmail inbox and valid Resend sender/key; test Google sign-in using the local
redirect URI and OAuth client configured above. Without those external
credentials, provider delivery and OAuth callbacks cannot be end-to-end
verified.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
