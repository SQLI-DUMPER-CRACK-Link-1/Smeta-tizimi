export const onRequestGet: PagesFunction<{ GOOGLE_CLIENT_ID: string }> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const state = crypto.randomUUID(); // CSRF himoyasi

  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', ctx.env.GOOGLE_CLIENT_ID);
  auth.searchParams.set('redirect_uri', `${url.origin}/api/auth/google/callback`);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('state', state);
  auth.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
};
