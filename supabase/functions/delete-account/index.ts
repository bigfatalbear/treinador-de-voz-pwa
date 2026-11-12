import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const rooms = ['geral', 'soprano', 'contralto', 'tenor', 'baixo'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sessão não encontrada.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'Servidor não configurado.' }, 500);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: 'Sessão inválida.' }, 401);
  }

  const user = authData.user;
  const choirId = 'principal';

  try {
    for (const room of rooms) {
      const folder = `choirs/${choirId}/chat/${room}`;
      const { data: files } = await admin.storage.from('media').list(folder, { limit: 1000 });
      const paths = (files || [])
        .filter((file) => file.name.startsWith(`${user.id}-`))
        .map((file) => `${folder}/${file.name}`);
      if (paths.length > 0) {
        await admin.storage.from('media').remove(paths);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return json({ error: 'Não foi possível apagar a conta.' }, 500);
  }
});
