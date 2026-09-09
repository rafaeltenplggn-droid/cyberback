# CYBER - especificacao tecnica compartilhada

## Grid e projecao

**PROJECTION LOCK (sprint topdown):** a projecao ativa do jogo mudou de
isometrica 2:1 pra **top-down ortogonal**. Grid logico continua sendo uma
celula por posicao, sem pixel livre - so a forma de desenhar mudou, a
posicao logica (col, row) e tudo que depende dela (colisao, doors, spawn,
mapa.json) nao mudou em nada.

Tile visual: quadrado 32x32 (`TILE_SIZE`, ver `src/core/topdown.js`).
`gridToScreen` retorna o CENTRO visual da celula:
screenX = originX + col * TILE_SIZE + TILE_SIZE / 2
screenY = originY + row * TILE_SIZE + TILE_SIZE / 2

`screenToGrid` faz o inverso. Props e personagem usam ancora
BOTTOM-CENTER/FEET (a posicao logica representa onde o objeto toca o
chao), nao o centro da celula. Depth/draw-order e simples: quem esta
mais ao norte (row menor) desenha atras, quem esta mais ao sul (row
maior) desenha na frente - ver `Renderer.drawPropsAndCharacter`.

A projecao isometrica antiga (`src/core/isometric.js`, TILE_WIDTH=64,
TILE_HEIGHT=32, formato losango) fica mantida no repositorio pra
rollback, mas nao e mais usada por nenhum consumidor ativo.

## Movimento do personagem
4 direcoes, sem diagonal. Um passo equivale a uma celula, a posicao logica so atualiza no fim do tween. Tween visual de 150 a 180ms por passo. Input novo entra em fila e nao interrompe o tween em andamento. Colisao checada por lookup numa matriz binaria separada da camada visual.

## Sprite do personagem
12 frames por arquetipo: 4 direcoes vezes parado, passo 1, passo 2. O frame de direita e derivado espelhando o frame de esquerda em tempo de render, nunca depende de asset separado pra essa direcao.

## Entrada de sala
Sala e troca completa de mapa, nunca camada ou zoom. Door e um trigger invisivel numa unica celula: ao ser pisado, troca o mapa.json carregado inteiro e reposiciona o personagem no spawn definido pelo destino. Nao existe teleporte livre fora de door.

## Formato do mapa, exemplo real
{
  "id": "distrito_07",
  "tileset": "distrito_07",
  "width": 40,
  "height": 30,
  "tiles": [[0,0,1,1]],
  "collision": [[0,0,1,1]],
  "doors": [
    { "x": 12, "y": 5, "target_map": "gridcorp_interior", "spawn_x": 3, "spawn_y": 14 }
  ],
  "props": [
    { "id": "streetlamp_cyan", "asset": "streetlamp_cyan.png", "origin_x": 8, "origin_y": 8, "footprint_w": 1, "footprint_h": 1, "collision_footprint": false }
  ]
}

tiles referencia ids de piso, tile_plain, tile_edge, tile_corner, tile_cracked, nunca ocupam mais de uma celula e nunca bloqueiam. collision e camada separada, binaria. door e gatilho de troca de mapa, sem representacao visual propria. prop e objeto visual com footprint que pode ocupar varias celulas, e se collision_footprint for true, todas as celulas do footprint viram bloqueadas na matriz de colisao ao carregar o mapa. prop e door podem coexistir na mesma celula.

## Catalogo de props definidos ate agora
streetlamp_cyan, footprint 1x1, sem colisao. planter_green, footprint 1x1, sem colisao. crate_stack_magenta, footprint 1x1, com colisao. shop_compact, footprint 1x2, com colisao, medir asset real antes de fixar. shop_mid, footprint 2x2, com colisao, medir asset real antes de fixar.

## Divisao de responsabilidade
O codigo de mapas, salas e props e desta branch, feat/maps-rooms. O codigo de personagem, camera e input e de outra branch, feat/character-controller, e nao deve ser tocado aqui. Este arquivo so muda se as duas partes combinarem antes.

## Nucleo compartilhado
src/core/topdown.js (projecao ativa - ver Projection Lock) e src/render/renderer.js sao utilitarios compartilhados. Quem precisa de grid<->tela sempre importa e reaproveita esses arquivos, nunca reimplementa a logica de projecao ou o loop de render por conta propria.

## Mapa district_07
Grid de 24 colunas por 16 linhas (x de 0 a 23, y de 0 a 15). Desde a sprint
"Sector 7 Background Art" (ver secao abaixo), o exterior usa a arte final
(Visual Master oficial) como fundo de mapa inteiro em vez de tiles
individuais - `map.background` aponta pro arquivo em `assets/backgrounds/`.
`tiles` continua existindo no mapa.json (tudo zero) so porque o parser
exige a matriz, mas nao e desenhado quando ha background.

Footprints de colisao (nao ha mais props visuais - a arte ja vem pronta no
fundo):
- BAR (nullpoint_bar), origem x0 y0, footprint 8x5
- BLACKNET (ghost_row_market), origem x8 y0, footprint 8x5
- CORP (gridcorp_tower), origem x16 y0, footprint 8x5
- MY HOME (player_home_building), origem x4 y9, footprint 6x4
- DATA TERMINAL (data_terminal_building), origem x16 y9, footprint 5x4
- predio de cenario sem porta (ao lado da MY HOME), origem x0 y9, footprint 4x5
- bordas do mapa: coluna 0 inteira, coluna 23 inteira, linha 15 inteira (fim da tela)

Portas do district_07 (calibradas visualmente pra baterem com a entrada de
cada predio na imagem de fundo):
- x4 y5, target_map nullpoint_interior (BAR), spawn_x 5, spawn_y 7
- x11 y5, target_map ghost_row_interior (BLACKNET), spawn_x 8, spawn_y 8
- x18 y5, target_map gridcorp_interior (CORP), spawn_x 5, spawn_y 7
- x7 y13, target_map player_home (MY HOME), spawn_x 5, spawn_y 7
- x18 y13, target_map data_terminal_interior (DATA TERMINAL), spawn_x 5, spawn_y 7

## World Structure Lock

Camera fixa por mapa: o jogo nao usa mais camera que segue o personagem
(o `updateCamera()` por frame foi removido). Em vez disso, `centerMapOrigin`
(`src/core/topdown.js`) calcula uma unica vez, a cada troca de mapa (load
inicial e toda vez que `onMapChanged` dispara por uma porta), a origem que
centraliza o mapa inteiro no canvas: `originX = (canvasWidth - map.width *
TILE_SIZE) / 2`, mesma coisa pro eixo Y. Generico, depende so de
`map.width`/`map.height`/`TILE_SIZE` - funciona igual pro exterior e pra
qualquer interior, sem scroll nem zoom.

Sector 7 (district_07) tem 5 portas ligando pra 5 destinos, cada um um
map.json separado: MY HOME (`player_home`), BAR (`nullpoint_interior`),
BLACKNET (`ghost_row_interior`), CORP (`gridcorp_interior`) e DATA TERMINAL
(`data_terminal_interior`, mapa novo desta sprint - os outros 4 ja
existiam e foram reaproveitados, sem duplicar). Toda porta de saida de um
interior fica fora da propria celula da porta de entrada, num chao livre
na frente do predio correspondente (evita spawn preso em colisao e evita
loop de reentrar na porta ao sair). Interiores sao blockouts funcionais
por enquanto (piso, parede/colisao, porta, spawn) - podem ganhar arte
propria depois, numa sprint futura.

## Sector 7 Replica Blockout

district_07 foi redesenhado de 16x12 pra 24x16 pra reproduzir o layout do
Visual Master oficial (imagem de referencia do exterior do Sector 7):
3 predios numa fileira de cima (BAR, BLACKNET, CORP) e 2 numa fileira de
baixo (MY HOME, DATA TERMINAL), com uma rua horizontal principal e uma rua
vertical formando um cruzamento no meio do mapa. Nessa sprint ainda era
blockout (tiles/props placeholder) - a arte final veio na sprint seguinte,
ver "Sector 7 Background Art" abaixo.

Como as posicoes dos 3 predios hackaveis mudaram, `HACKABLE_BUILDINGS`
(`src/hackIntegration/hackableBuildings.js`) foi atualizado pra apontar
pras novas coordenadas - so as coordenadas, o mecanismo de hack (tier,
target, adjacencia) continua o mesmo. As portas de saida dos 5 interiores
tambem foram reapontadas pro spawn correto em frente a cada predio na
nova posicao.

## Sector 7 Background Art

O exterior do district_07 usa a imagem do Visual Master oficial como fundo
de mapa inteiro (`assets/backgrounds/sector7_exterior.png`, referenciada
por `map.background` no mapa.json), em vez de compor a cena com tiles e
props individuais. `Renderer.drawMap` desenha essa imagem esticada pra
cobrir `map.width * TILE_SIZE` x `map.height * TILE_SIZE` quando o mapa
tem `background` e a imagem ja carregou; sem isso (ou por enquanto em
qualquer outro mapa), cai no render de tiles de sempre.

Colisao e portas foram recalibradas medindo a posicao real de cada predio
na imagem (grid de 24x16 sobreposto pra conferencia visual) - nao usam
mais props pra desenhar retangulo placeholder, so a matriz de colisao
bloqueia o footprint de cada predio (ver coordenadas na secao "Mapa
district_07" acima). `district_07.json` nao tem mais props (lista vazia);
postes, decoracao e NPCs parados que aparecem na imagem sao so parte do
fundo, nao objetos separados.

NPCs dinamicos/interativos futuros devem ser desenhados como sprites
separados por cima do fundo (mesmo mecanismo do personagem principal),
nunca bakeados na imagem - permite reposicionar/animar sem reeditar a
arte. O trade-off aceito: reposicionar um predio dessa cena exige editar a
imagem de novo, nao só o mapa.json - so vale a pena pra uma composicao ja
aprovada como definitiva, como e o caso do Sector 7.

`map.reflections` (opcional, so district_07 usa por enquanto) e uma lista
de pontos `{x, y, radius, color, periodMs, phase}` em coordenadas de grid,
desenhados por `Renderer.drawReflections` como gradiente radial aditivo
sobre o fundo, com a opacidade oscilando em `Math.sin` ao longo do tempo
(cada um com periodo/fase proprios pra nao pulsarem em sincronia) - o
efeito de luz de neon "respirando" na rua molhada. Puramente visual, nao
afeta colisao nem gameplay.

## Interior: MY HOME

Primeiro interior a sair do blockout - usa o mesmo mecanismo de fundo real
do Sector 7 (`map.background`, ver secao acima), so que numa sala 16x12
em vez do 10x10 generico. `assets/backgrounds/player_home_interior.png`
mostra o quarto inteiro (banheiro, geladeira, mesa com PC de 3 monitores,
cama, mesinha de centro, porta de saida) - `district_07.json` nao mudou,
so o `player_home.json`.

Colisao recalibrada pra bater com os moveis reais da imagem (banheiro,
geladeira, estante, mesa do PC, cama, bau, mesinha) em vez do quarto vazio
de antes. Os pontos de interacao (`HOME_PC_LOCATION`, `HOME_BED_LOCATION`
em `src/hackIntegration/homeLocations.js`) foram recalibrados pras novas
coordenadas - mesma logica de adjacencia de sempre (`isAdjacentToBuilding`),
so a posicao mudou. Porta de saida em (7,9), no vao da parede sul da
imagem.

BAR (`nullpoint_interior`) e BLACKNET (`ghost_row_interior`) ja ganharam
arte propria depois (ver secao "Economia: Informacao e BLACKNET" pro
BLACKNET). CORP e DATA TERMINAL continuam em blockout 10x10 generico.

## Economia: Informacao e BLACKNET

Hackear um predio (gridcorp_tower, nullpoint_bar, ghost_row_market) nao
credita BYTE direto no ledger mais - `fence()` (`src/hackloop/fence.js`)
continua rodando exatamente igual (calcula o valor do loot), mas o
resultado vira uma unidade de Informacao em vez de BYTE, com raridade
determinada pelo tier do predio (`infoRarityForTier`, ver
`src/hackIntegration/informationLedger.js`): comum -> comum, incomum ->
rara, raro -> epica. `InformationLedger` guarda so a contagem por
raridade (sem log de entradas, ao contrario do ByteLedger).

Tiers dos 3 predios hackaveis (`src/hackIntegration/hackableBuildings.js`):
gridcorp_tower (comum) < nullpoint_bar (incomum) < ghost_row_market/
BLACKNET (raro, o mais dificil - e o mercado negro, faz sentido ser o
alvo mais protegido).

A Informacao so vira BYTE de verdade na BLACKNET (dentro do
ghost_row_interior): a BLACKNET tem arte de fundo real
(`assets/backgrounds/blacknet_interior.png`, 16x12, mesmo esquema do
BAR/MY HOME) com 4 mesas - o corretor (`BLACKNET_BROKER_LOCATION` em
`src/hackIntegration/blacknetLocations.js`) fica sentado numa delas o
tempo todo, e vende todo o estoque de uma vez
(`InformationLedger.sellAll()`) quando o jogador fica na frente dele
(ao sul, mesma logica de `allowedSides` do atendente do bar), ao preco
por raridade em `INFO_SELL_PRICE_BYTE` (comum 5, rara 25, epica 60 -
valores baixos de proposito, informacao e um item farmavel). As outras
3 mesas (`BLACKNET_WORKER_DESKS`) vao ficando ocupadas (sprite estatico
de costas, ver `drawBlacknetWorkers` em main.js) conforme cada
trabalhador contratavel (`HIRABLE_WORKERS`, ver workers.js) e
contratado - cada um com uma passiva pequena (`WORKER_PASSIVES`, so um
bonus/penalidade discreto na chance de sucesso do minerio automatico).

O PC de casa (player_home) nao vende mais recarga de energia - virou um
ponto de "minerar informacao" (`src/hackIntegration/infoMining.js`):
chance fixa de sucesso (`INFO_MINING_SUCCESS_CHANCE`), e quando da certo
sempre rende 1 unidade de Informacao comum (a fonte facil/barata;
informacao melhor so vem hackeando os predios de verdade). A tecla
continua sendo B.

Minerar no PC gasta energia toda vez que tenta, sucesso ou falha - um
quarto da energia maxima (`INFO_MINING_ENERGY_COST_RATIO = 0.25`), pra
nao virar fonte infinita de informacao/BYTE (antes nao gastava nada).
`HackRuntime.mineInformation()` tambem passou a ser assincrono: leva uns
30 segundos de verdade (`DEFAULT_MINING_DELAY_MS`) em que
`isMining`/`isMovementBlocked` ficam true e a UI mostra "[B]
minerando... Ns" com contagem regressiva (`miningRemainingMs`) - antes o
resultado aparecia instantaneo, sem nenhum feedback de que algo estava
acontecendo. Hackear os predios de verdade continua custando mais
energia que minerar no PC e progressivo por tier (`ENERGY_COST_PER_TIER`
em `src/hackIntegration/energyCosts.js`: comum 30, incomum 40, raro 50 -
todos acima dos 25 do PC), reforcando que a informacao melhor
(rara/epica) vem de um risco maior. Os valores de energia foram
recalibrados uma vez pra baixo (de um primeiro rascunho 50/60/75/90) por
ficarem pesados demais somados a chance de sucesso ja ser baixa nos
tiers mais dificeis.

### Trabalhadores contratados (`src/hackIntegration/workers.js`)

Alem de minerar manualmente, o jogador pode contratar os outros
personagens do elenco (`character2`/`character3`/`character4` -
Ghost Netrunner, Drone Engineer, Corporate Spy - ver
`src/character/characterRoster.js`) pra minerar informacao sozinhos, em
tempo real, pelo resto da partida. Cada contratacao custa
`WORKER_HIRE_COST_BYTE` (150 BYTE) e e paga uma unica vez por
personagem; da pra contratar todos ao mesmo tempo. Um trabalhador
contratado tenta minerar (mesma `INFO_MINING_SUCCESS_CHANCE` do PC, sem
gastar a energia do jogador - a "energia" dele e sempre cheia) a cada
`WORKER_WORK_INTERVAL_MS` (30s), via `WorkerRoster.tick()`, chamado a
cada frame de `HackRuntime.tick()` **mesmo com o movimento do jogador
bloqueado** - ele trabalha sozinho, independente do que o jogador esta
fazendo. Sem nenhum prop fisico no mapa: e so um estoque de "quem esta
contratado", com a UI (menu no PC, teclas 1/2/3) sendo o unico jeito de
interagir por enquanto - pensado pra virar uma aba com a foto de cada um
dentro da futura tela do PC (ver o mockup do terminal de hack
compartilhado com o usuario).

Energia agora so recupera de duas formas: dormindo na cama do quarto
(de graca, cooldown de 2 minutos, sem mudanca) ou comprando um
energetico no balcao/atendente do bar (`src/hackIntegration/drinkShop.js`,
tecla D, preco `DRINK_COST_BYTE`) - o drink deixou de dar um buff
temporario de breachSpeed e virou a fonte "premium" de energia
(`DrinkBuffTracker` foi removido do projeto).

## Tela de invasao (PC screen)

Hackear um predio (ESPACO/ENTER) ou minerar no PC de casa (tecla B) abre
um overlay visual por cima do jogo - `#pc-screen` em `index.html`, todo
controlado em `src/main.js` (nenhuma logica de jogo mora ali, so
apresentacao: le o que `HackRuntime`/`HackSession` ja calculam e anima).
Visual de monitor CRT (scanlines, fonte `VT323` estilo terminal antigo,
`Rajdhani`/`IBM Plex Mono` pro resto da UI) - validado antes com um
mockup interativo mostrado ao usuario.

Duas abas: **TERMINAL** (sempre visivel - log de linhas indo aparecendo
uma a uma, barra de progresso, alvo/tier no cabecalho) e **EQUIPE** (so
aparece durante a mineracao no PC, nunca num hack de predio - e onde o
jogador contrata os trabalhadores, ver secao anterior; cada card mostra o
retrato do personagem via `loadPortraitImage`, nome, e um botao de
contratar/status "contratado"). ESC fecha a tela a qualquer momento, mas
e so cosmetico - o hack/mineracao em andamento continua rodando por
baixo (o resultado real nao depende da tela estar aberta).

Hackear um predio resolve rapido demais nos bastidores pra acompanhar
visualmente (breach() nao tem delay real, so um numero simulado) -
`runHackAnimation()` toca uma sequencia cosmetica de ~1.5s em paralelo
(`Promise.all` com `hackRuntime.triggerHack()`) so pra nao parecer
instantaneo, sem mudar nada do tempo/energia/chance reais. Minerar no PC
ja leva ~30s de verdade (ver secao anterior), entao a tela so acompanha o
`miningRemainingMs` de verdade (`setInterval` atualizando a barra +
linhas de "sabor" aleatorias tipo "escaneando redes abertas...") em vez
de fingir um tempo proprio.

### Menu do PC, hack remoto, e trava de nivel

A tecla B no PC nao dispara mais a mineracao direto - abre a tela num
**menu** (`#pc-menu` em `index.html`, `renderPcMenu()`/`pcScreenShowMenu()`
em `main.js`): o jogador escolhe "Minerar" ou um dos 3 predios pra
"Hackear remoto", e so ai a acao comeca de verdade (`startMining()` /
`startRemoteHack()`). Antes disso a tela so ficava aberta contando os 30s
sem dar nenhuma opcao.

Hackear remoto (`HackRuntime.triggerRemoteHack(buildingId)`) roda o
mesmo `HackSession` de sempre, so que sem exigir proximidade fisica do
predio - so precisa estar parado no PC, e nao pode ja ter outro
hack/mineracao em andamento. Depois que a acao termina (minerar ou
hackear remoto), a tela volta pro menu sozinha (em vez de fechar) - da
pra emendar varias acoes sem reabrir o PC toda hora; ESC continua
fechando a qualquer momento.

Cada tier de predio agora exige um nivel minimo do jogador pra ser
hackeado - `src/hackIntegration/hackLevelGate.js`,
`REQUIRED_LEVEL_PER_TIER` (comum 1, incomum 3, raro 5) - vale tanto pro
hack fisico (`triggerHack`) quanto pro remoto (`triggerRemoteHack`),
mesma trava, mesma funcao (`_runHack`). Abaixo do nivel exigido o hack
nem tenta - resultado com `levelBlocked: true` (mesmo espirito do
`energyBlocked` que ja existia), mostrado na tela como "NIVEL
INSUFICIENTE". A lista de alvos no menu (`remoteHackTargets`) ja vem com
`locked`/`requiredLevel` prontos pra UI desabilitar os botoes dos
predios ainda travados.

### Hackear tambem leva um tempo de verdade, e a loja de pets

Hackear um predio (fisico ou remoto) tambem passou a levar um tempo real
- `DEFAULT_HACK_DELAY_MS` (20s) em `hackRuntime.js`, mesmo padrao do
`DEFAULT_MINING_DELAY_MS` (30s) que a mineracao ja usava. `_runHack()`
calcula o resultado de verdade na hora (pra nao duplicar a logica de
energia/nivel do `HackSession`), mas so "revela" (a Promise so resolve)
depois desse tempo - exceto quando o hack nem chega a tentar
(`energyBlocked`), caso em que nao faz sentido segurar o jogador so pra
dizer que faltou energia. `isHacking`/`hackRemainingMs` (mesma forma de
`isMining`/`miningRemainingMs`) deixam a UI mostrar a contagem regressiva
e bloqueiam o movimento por todo esse tempo, nao so durante o calculo em
si (que e quase instantaneo).

Terceira aba no PC, **LOJA** (`src/hackIntegration/pets.js`): compra de
pet, puramente decorativo (nenhum efeito no jogo, nao ajuda a minerar
nem da bonus - so um "tenho ou nao tenho"). Comeca com um unico pet, o
gato (`PET_COST_BYTE` = 100), com espaco de sobra pra adicionar mais
depois sem reestruturar nada (mesmo formato de `HIRABLE_WORKERS` em
workers.js). Ainda sem arte propria - a loja mostra um emoji de gato no
lugar de um retrato de verdade, e comprar o pet nao adiciona nenhum
sprite no quarto (so fica registrado como "adotado" na loja).
