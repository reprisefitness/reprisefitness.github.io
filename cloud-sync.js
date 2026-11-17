(() => {
  'use strict';
  const config = window.REPRISE_SUPABASE_CONFIG || {};
  const configured = () => Boolean(config.url && config.publishableKey);
  let clientPromise;

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0';
      script.async = true;
      script.onload = () => window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(Error('De Supabase-bibliotheek kon niet worden geladen.'));
      script.onerror = () => reject(Error('Geen verbinding met Supabase. Probeer het later opnieuw.'));
      document.head.append(script);
    });
  }

  async function client() {
    if (!configured()) throw Error('De cloudaccount is nog niet gekoppeld.');
    if (!clientPromise) clientPromise = loadSdk().then(sdk => sdk.createClient(config.url, config.publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    }));
    return clientPromise;
  }

  async function check(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  window.RepRiseCloud = {
    configured,
    async getSession() {
      const c = await client();
      return check(await c.auth.getSession()).then(x => x.session);
    },
    async signUp(email, password, name) {
      const c = await client();
      return check(await c.auth.signUp({ email, password, options: { data: { display_name: name } } }));
    },
    async signIn(email, password) {
      const c = await client();
      return check(await c.auth.signInWithPassword({ email, password }));
    },
    async signOut() {
      const c = await client();
      return check(await c.auth.signOut());
    },
    async getUserData(userId) {
      const c = await client();
      const rows = await check(await c.from('reprise_user_data').select('payload').eq('user_id', userId).limit(1));
      return rows?.[0]?.payload || null;
    },
    async saveUserData(userId, payload) {
      const c = await client();
      return check(await c.from('reprise_user_data').upsert({ user_id: userId, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
    },
    async getPhotos(userId) {
      const c = await client();
      return check(await c.from('reprise_photos').select('*').eq('user_id', userId));
    },
    async uploadPhoto(userId, photo) {
      const c = await client();
      const ext = photo.blob?.type === 'image/png' ? 'png' : 'jpg';
      const path = `${userId}/${photo.id}.${ext}`;
      const upload = await c.storage.from('reprise-photos').upload(path, photo.blob, {
        upsert: true,
        contentType: photo.blob?.type || 'image/jpeg'
      });
      if (upload.error) throw upload.error;
      const row = {
        user_id: userId, photo_id: photo.id, taken_on: photo.date,
        weight: String(photo.weight || ''), note: String(photo.note || ''),
        file_name: String(photo.name || ''), object_path: path,
        deleted: false, updated_at: new Date().toISOString()
      };
      return check(await c.from('reprise_photos').upsert(row, { onConflict: 'user_id,photo_id' })).then(() => path);
    },
    async downloadPhoto(path) {
      const c = await client();
      const result = await c.storage.from('reprise-photos').download(path);
      if (result.error) throw result.error;
      return result.data;
    },
    async deletePhoto(userId, photoId, path) {
      const c = await client();
      if (!path) {
        const existing = await c.from('reprise_photos').select('object_path').eq('user_id', userId).eq('photo_id', photoId).limit(1);
        if (existing.error) throw existing.error;
        path = existing.data?.[0]?.object_path;
      }
      const mark = await c.from('reprise_photos').update({ deleted: true, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('photo_id', photoId);
      if (mark.error) throw mark.error;
      if (path) {
        const removed = await c.storage.from('reprise-photos').remove([path]);
        if (removed.error) throw removed.error;
      }
    }
  };
})();
