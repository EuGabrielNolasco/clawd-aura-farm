import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Content Security Policy no build: o navegador só roda scripts do próprio site e só
 * conversa com o Supabase do ranking. Fica fora do dev porque o Vite injeta scripts para o HMR.
 */
function csp(supabaseUrl: string | undefined): Plugin {
  const connect = supabaseUrl
    ? `'self' ${new URL(supabaseUrl).origin} https://accounts.google.com https://www.googleapis.com`
    : "'self' https://accounts.google.com https://www.googleapis.com";
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "font-src https://fonts.gstatic.com",
    "frame-src 'self' https://accounts.google.com",
    "img-src 'self' data: https://*.googleusercontent.com",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "csp",
    apply: "build",
    transformIndexHtml: html =>
      html.replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    // caminhos relativos para funcionar em https://<usuario>.github.io/clawd-aura-farm/
    base: "./",
    plugins: [csp(env.VITE_SUPABASE_URL)],
  };
});
