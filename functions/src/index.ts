import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import type { CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'southamerica-east1', maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();
const choirId = process.env.CHOIR_ID || 'principal';

const REGENT_EMAILS = defineSecret('REGENT_EMAILS');
const CHOIR_INVITE_CODE = defineSecret('CHOIR_INVITE_CODE');

const VOICE_PARTS = ['soprano', 'contralto', 'tenor', 'baixo'];
const ROOMS = ['geral', 'soprano', 'contralto', 'tenor', 'baixo'];

interface AuthContext {
  uid: string;
  email: string;
  name: string;
}

function requireAuth(request: CallableRequest): AuthContext {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }
  const token = request.auth.token;
  return {
    uid: request.auth.uid,
    email: String(token.email || '').toLowerCase(),
    name: String(token.name || token.email || 'Coralista')
  };
}

async function requireMember(uid: string): Promise<FirebaseFirestore.DocumentData> {
  const snapshot = await db.doc(`choirs/${choirId}/members/${uid}`).get();
  if (!snapshot.exists) {
    throw new HttpsError('permission-denied', 'Você não faz parte deste coral.');
  }
  return snapshot.data() || {};
}

function cleanName(value: unknown, fallback: string): string {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, 80);
}

function validVoicePart(value: unknown): value is string {
  return typeof value === 'string' && VOICE_PARTS.includes(value);
}

export const syncRegentRole = onCall(
  { secrets: [REGENT_EMAILS] },
  async (request) => {
    const context = requireAuth(request);
    const reference = db.doc(`choirs/${choirId}/members/${context.uid}`);
    const existing = await reference.get();
    const current = existing.data() || {};

    const allowed = REGENT_EMAILS.value()
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (!context.email || !allowed.includes(context.email)) {
      if (current.role === 'regente') {
        await reference.set(
          {
            role: 'coralista',
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        await auth.setCustomUserClaims(context.uid, { role: 'coralista', choirId });
      }
      return { regent: false };
    }

    await reference.set(
      {
        name: cleanName(current.name, context.name),
        email: context.email,
        role: 'regente',
        voicePart: validVoicePart(current.voicePart) ? current.voicePart : 'soprano',
        createdAt: current.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await auth.setCustomUserClaims(context.uid, { role: 'regente', choirId });
    return { regent: true };
  }
);

export const joinChoir = onCall(
  { secrets: [CHOIR_INVITE_CODE] },
  async (request) => {
    const context = requireAuth(request);
    const code = String(request.data?.code || '');
    const expected = CHOIR_INVITE_CODE.value();

    if (!expected || code !== expected) {
      throw new HttpsError('permission-denied', 'Código de convite inválido.');
    }

    const voicePart = request.data?.voicePart;
    if (!validVoicePart(voicePart)) {
      throw new HttpsError('invalid-argument', 'Naipe inválido.');
    }

    const reference = db.doc(`choirs/${choirId}/members/${context.uid}`);
    const existing = await reference.get();
    const current = existing.data() || {};
    const role = current.role === 'regente' ? 'regente' : 'coralista';
    const name = cleanName(request.data?.name, context.name);

    await reference.set(
      {
        name,
        email: context.email,
        role,
        voicePart,
        createdAt: current.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await auth.setCustomUserClaims(context.uid, { role, choirId, voicePart });

    return {
      id: context.uid,
      name,
      email: context.email,
      role,
      voicePart
    };
  }
);

export const getMediaUrl = onCall(async (request) => {
  const context = requireAuth(request);
  const path = String(request.data?.path || '');

  if (!path.startsWith(`choirs/${choirId}/`)) {
    throw new HttpsError('permission-denied', 'Caminho de mídia inválido.');
  }

  const member = await requireMember(context.uid);
  const segments = path.split('/');

  if (segments[2] === 'chat') {
    const room = segments[3];
    if (!ROOMS.includes(room)) {
      throw new HttpsError('permission-denied', 'Sala inválida.');
    }
    const allowed = member.role === 'regente' || room === 'geral' || member.voicePart === room;
    if (!allowed) {
      throw new HttpsError('permission-denied', 'Sem acesso a esta sala.');
    }
  }

  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000
  });

  return { url };
});

export const deleteMyData = onCall(async (request) => {
  const context = requireAuth(request);
  await requireMember(context.uid);

  const polls = await db.collection(`choirs/${choirId}/polls`).get();
  for (const poll of polls.docs) {
    await poll.ref.collection('votes').doc(context.uid).delete();
  }

  for (const room of ROOMS) {
    const messages = await db
      .collection(`choirs/${choirId}/rooms/${room}/messages`)
      .where('authorId', '==', context.uid)
      .get();

    for (const message of messages.docs) {
      const audioPath = message.data().audioPath;
      if (typeof audioPath === 'string' && audioPath.startsWith(`choirs/${choirId}/chat/`)) {
        try {
          await bucket.file(audioPath).delete({ ignoreNotFound: true });
        } catch (error) {
          console.warn('Falha ao apagar áudio de chat.', error);
        }
      }
      await message.ref.delete();
    }
  }

  await db.doc(`choirs/${choirId}/members/${context.uid}`).delete();
  await auth.deleteUser(context.uid);

  return { deleted: true };
});
