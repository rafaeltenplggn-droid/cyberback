// Lista dos personagens/NFT jogaveis (ver ART_STYLE_GUIDE.md). Cada um
// mora em assets/<id>/ com o mesmo conjunto de arquivos: front_walk1.png,
// front_walk2.png, side_walk1.png, side_walk2.png, back_walk1.png,
// back_walk2.png, e opcionalmente front_idle.png (pose parada dedicada -
// se nao existir, cai pro front_walk1.png sozinho).
export const CHARACTER_ROSTER = [
  { id: 'character1', name: 'Shadow Hacker' },
  { id: 'character2', name: 'Ghost Netrunner' },
  { id: 'character3', name: 'Drone Engineer' },
  { id: 'character4', name: 'Corporate Spy' },
];

function loadImage(folder, fileName, fallbackFileName) {
  const img = new Image();
  if (fallbackFileName) {
    img.onerror = () => {
      img.onerror = null;
      img.src = `../assets/${folder}/${fallbackFileName}`;
    };
  }
  img.src = `../assets/${folder}/${fileName}`;
  return img;
}

/**
 * Carrega a mesma imagem usada como pose "idle" de frente (com fallback
 * pro passo 1 se nao houver front_idle.png dedicado) - usado tanto pelo
 * preview da tela de selecao quanto por loadCharacterAssets, pra nao
 * duplicar a logica de fallback nem recarregar a imagem duas vezes.
 */
export function loadFrontIdleImage(folder) {
  return loadImage(folder, 'front_idle.png', 'front_walk1.png');
}

/**
 * Monta o objeto `assets` no formato que CharacterRenderer espera
 * (ver src/character/characterRenderer.js), carregando os arquivos do
 * personagem escolhido. `frontIdleImage` (opcional) reaproveita uma
 * imagem ja carregada (ex: o preview da tela de selecao) em vez de
 * carregar de novo do zero.
 */
export function loadCharacterAssets(folder, { frontIdleImage } = {}) {
  const frontIdle = frontIdleImage ?? loadFrontIdleImage(folder);
  const frontStep1 = loadImage(folder, 'front_walk1.png');
  const frontStep2 = loadImage(folder, 'front_walk2.png');
  const sideStep1 = loadImage(folder, 'side_walk1.png');
  const sideStep2 = loadImage(folder, 'side_walk2.png');
  const backStep1 = loadImage(folder, 'back_walk1.png');
  const backStep2 = loadImage(folder, 'back_walk2.png');

  return {
    down: { idle: frontIdle, step1: frontStep1, step2: frontStep2 },
    up: { idle: backStep1, step1: backStep1, step2: backStep2 },
    left: { idle: sideStep1, step1: sideStep1, step2: sideStep2 },
  };
}
