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
Grid de 16 colunas por 12 linhas (x de 0 a 15, y de 0 a 11). Layout abaixo, onde ponto e chao (tile_plain), cerquilha e footprint de predio bloqueado, D e porta, L e streetlamp_cyan sem colisao, P e planter_green sem colisao, C e crate_stack_magenta com colisao:

```
. . . . . . . . . . . . . . . .
. # # . . . . . . . . . . . . .
. # # . . . . . . . . . . . . .
. D . . . . . . . . . . . . . .
. . . . . . . . . . # # . . . .
L . . . . . . . . . # # . . . .
. . . . . . . . . . D . . C . .
. . . . . . . . . . . . . . . .
. # # . . . . . P . . . . . . .
. # # . . . . . . . . . . . . .
. D . . . . . . . . . . . . . .
. . . . . . . . . . . . . . . .
```

Props com footprint 2x2 e collision_footprint true, ancorados no canto superior esquerdo de cada cerquilha:
- gridcorp_tower, origem x1 y1
- nullpoint_bar (asset shop_mid), origem x10 y4
- ghost_row_market (asset ghost_row_market), origem x1 y8
- player_home_building, origem x13 y0

Portas do district_07:
- x1 y3, target_map gridcorp_interior, spawn_x 5, spawn_y 7
- x10 y6, target_map nullpoint_interior, spawn_x 5, spawn_y 7
- x1 y10, target_map ghost_row_interior, spawn_x 5, spawn_y 7
