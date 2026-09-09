// Lista dos personagens/NFT jogaveis (ver ART_STYLE_GUIDE.md). Cada um
// mora em assets/<id>/ com o mesmo conjunto de arquivos: front_walk1.png,
// front_walk2.png, side_walk1.png, side_walk2.png, back_walk1.png,
// back_walk2.png, portrait.png (retrato pra tela de selecao), e
// opcionalmente front_idle.png (pose parada dedicada - se nao existir,
// cai pro front_walk1.png sozinho).
export const CHARACTER_ROSTER = [
  { id: 'character1', name: 'Shadow Hacker' },
  { id: 'character2', name: 'Ghost Netrunner' },
  { id: 'character3', name: 'Drone Engineer' },
  { id: 'character4', name: 'Corporate Spy' },
];

/**
 * Carrega `fileNames[0]`, e se falhar tenta `fileNames[1]`, e assim por
 * diante - primeiro arquivo da lista que existir de verdade. Usado tanto
 * pro sprite parado de frente (front_idle -> front_walk1) quanto pro
 * retrato da tela de selecao (portrait -> front_idle -> front_walk1),
 * numa unica implementacao em vez de repetir a cadeia de onerror em
 * cada lugar que precisa de um fallback.
 */
function loadImageWithFallback(folder, fileNames, img = new Image()) {
  let index = 0;
  img.onerror = function tryNext() {
    index += 1;
    if (index >= fileNames.length) {
      img.onerror = null;
      return;
    }
    img.src = `assets/${folder}/${fileNames[index]}`;
  };
  img.src = `assets/${folder}/${fileNames[0]}`;
  return img;
}

function loadImage(folder, fileName) {
  return loadImageWithFallback(folder, [fileName]);
}

/** Pose parada de frente, com fallback pro passo 1 se nao houver front_idle.png dedicado. */
export function loadFrontIdleImage(folder) {
  return loadImageWithFallback(folder, ['front_idle.png', 'front_walk1.png']);
}

/**
 * Retrato detalhado (busto, chest-up) usado so na tela de selecao de
 * personagem - nao no sprite que anda pelo mapa.
 */
export function loadPortraitImage(folder) {
  return loadImageWithFallback(folder, ['portrait.png', 'front_idle.png', 'front_walk1.png']);
}

/**
 * Mesma cadeia de fallback do retrato (portrait -> front_idle ->
 * front_walk1), mas aplicada direto num <img> que ja existe no DOM (ver
 * o avatar redondo do HUD em main.js) em vez de criar uma Image() nova -
 * assim o elemento real na tela recebe o onerror/fallback certinho.
 */
export function applyPortraitImage(imgEl, folder) {
  return loadImageWithFallback(folder, ['portrait.png', 'front_idle.png', 'front_walk1.png'], imgEl);
}

/**
 * Monta o objeto `assets` no formato que CharacterRenderer espera
 * (ver src/character/characterRenderer.js), carregando os arquivos do
 * personagem escolhido.
 */
export function loadCharacterAssets(folder) {
  const frontIdle = loadFrontIdleImage(folder);
  const frontStep1 = loadImage(folder, 'front_walk1.png');
  const frontStep2 = loadImage(folder, 'front_walk2.png');
  const sideStep1 = loadImage(folder, 'side_walk1.png');
  const sideStep2 = loadImage(folder, 'side_walk2.png');
  const backStep1 = loadImage(folder, 'back_walk1.png');
  const backStep2 = loadImage(folder, 'back_walk2.png');

  return {
    down: { idle: frontIdle, step1: frontStep1, step2: frontStep2 },
    up: { idle: backStep1, step1: backStep1, step2: backStep2 },
    // side_walk*.png mostra o personagem de perfil olhando pra DIREITA -
    // "esquerda" e sempre essa mesma arte espelhada em tempo de render
    // (ver spriteSheet.js/characterRenderer.js), nunca um arquivo proprio.
    right: { idle: sideStep1, step1: sideStep1, step2: sideStep2 },
  };
}
