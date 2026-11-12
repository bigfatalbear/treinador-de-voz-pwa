export const APP_NAME = 'CORAL PIBENS ACADEMY';
export const APP_SHORT_NAME = 'PIBENS';
export const APP_VERSION = '1.1.0';
export const APP_UUID = '2dfce9de-de4b-57ae-a291-a170c20195cd';
export const APP_DESCRIPTION =
  'Treino de coral offline com mixer de naipes, afinador, looping A-B, partitura, vídeos do YouTube e gestão do coral.';
export const APP_LOGO = 'coral-pibens-academy.png';
export const APP_LOGO_URL = `${import.meta.env.BASE_URL}${APP_LOGO}`;

export const CHOIR_ID = import.meta.env.VITE_CHOIR_ID || 'principal';
export const GITHUB_REPO = 'https://github.com/bigfatalbear/treinador-de-voz-pwa';
export const APP_URL = 'https://bigfatalbear.github.io/treinador-de-voz-pwa/';

export const PIX_PAYLOAD =
  '00020126330014br.gov.bcb.pix0111015619225015204000053039865802BR5921FABIO SILVA DOS ANJOS6009Sao Paulo62290525REC6AF09CB01264A2203363336304C140';

export const PIX_RECEIVER = 'FABIO SILVA DOS ANJOS';
export const PIX_CITY = 'Sao Paulo';

export const LIMITS = {
  trackFileBytes: 25 * 1024 * 1024,
  scoreFileBytes: 10 * 1024 * 1024,
  chatAudioBytes: 2 * 1024 * 1024,
  chatAudioSeconds: 60,
  overdubSeconds: 300,
  messageChars: 2000,
  bpmMin: 50,
  bpmMax: 150,
  baseBpm: 100
} as const;

export const RETENTION_DAYS = {
  chat: 90,
  attendance: 365
} as const;
