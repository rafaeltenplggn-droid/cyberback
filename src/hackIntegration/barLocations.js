// O bar (nullpoint_interior, dentro do nullpoint_bar): tem um balcao que
// vende drinks, um banco pra sentar (so cosmetico) e um laptop (hackeia o
// nullpoint_bar remotamente, sem sair do bar). Reaproveita
// isAdjacentToBuilding de hackableBuildings.js - mesma logica de "esta do
// lado", nao reimplementada aqui. O nullpoint_bar em si continua hackavel
// exatamente como ja era, sem nenhuma mudanca.
import { isAdjacentToBuilding } from './hackableBuildings.js';

export const BAR_MAP_ID = 'nullpoint_interior';

// O laptop hackeia esta mesma entrada de HACKABLE_BUILDINGS (hackableBuildings.js) -
// exportado aqui pra quem usa 'laptop' nao precisar repetir a string solta.
export const BAR_HACKABLE_BUILDING_ID = 'nullpoint_bar';

// Coordenadas calibradas visualmente pra baterem com o balcao/banquinhos
// na arte de fundo de maps/nullpoint_interior.json (nao ha mais props
// visuais aqui - mesmo esquema do player_home, ver homeLocations.js).
// "Counter" e o ponto generico de pedir na propria fileira dos bancos
// (fileira 4) - o balcao em si (bandeja/prateleiras) fica na fileira 3,
// bloqueada, entao o footprint fica sobre um dos bancos da arte (coluna 8)
// e a interacao vem de qualquer lado aberto ao redor.
export const BAR_COUNTER_LOCATION = { originX: 8, originY: 4, footprintW: 1, footprintH: 1 };

// Banco calibrado pra bater com um banco de verdade da arte (ver
// assets/backgrounds/nullpoint_bar_interior.png) - os bancos ficam nas
// colunas 6 a 11 da fileira 4; usa a coluna 6 (a mais a esquerda, livre de
// qualquer outro ponto de interacao).
export const BAR_STOOL_LOCATION = { originX: 6, originY: 4, footprintW: 1, footprintH: 1 };

// O laptop e o terminal "PLAY BREATHE REPEAT" que ja esta desenhado na
// propria arte de fundo (canto superior direito, com o banquinho na
// frente dele - ver assets/backgrounds/nullpoint_bar_interior.png,
// coluna 13). Mesma logica do atendente/balcao: fileira 3 e parede/mobilia
// solida, so alcancavel de frente (fileira 4, ao sul, onde fica o banquinho).
export const BAR_LAPTOP_LOCATION = { originX: 13, originY: 3, footprintW: 1, footprintH: 1 };
const BAR_LAPTOP_APPROACH_SIDES = ['south'];

// Posicao exata do atendente na arte (o personagem desenhado atras do
// balcao, ver assets/backgrounds/nullpoint_bar_interior.png - coluna 8,
// mesma do balcao, na fileira 3, colada na parede/prateleira atras dele).
// So pode ser abordado por quem esta na fileira 4, direto na frente dele
// (norte/leste/oeste caem dentro da propria parede da fileira 2-3,
// inalcancaveis de qualquer forma, mas o lado fica explicito mesmo assim).
export const BAR_NPC_LOCATION = { originX: 8, originY: 3, footprintW: 1, footprintH: 1 };
const BAR_NPC_APPROACH_SIDES = ['south'];

/** Retorna 'counter', 'stool', 'laptop', 'bartender' ou null, dependendo de onde o personagem esta parado dentro do bar. */
export function nearbyBarInteractable(mapManager) {
  if (mapManager.currentMap?.id !== BAR_MAP_ID) return null;
  const { playerCol, playerRow } = mapManager;
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_COUNTER_LOCATION)) return 'counter';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_STOOL_LOCATION)) return 'stool';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_LAPTOP_LOCATION, BAR_LAPTOP_APPROACH_SIDES)) return 'laptop';
  if (isAdjacentToBuilding(playerCol, playerRow, BAR_NPC_LOCATION, BAR_NPC_APPROACH_SIDES)) return 'bartender';
  return null;
}
