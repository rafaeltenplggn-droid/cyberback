# CYBER - especificacao tecnica compartilhada

## Grid e projecao
Grid logico de uma celula por posicao, sem pixel livre. Tile visual isometrico 2:1, 64px de largura por 32px de altura, formato losango. Conversao de grid pra tela:
screenX = originX + (col - row) * 32
screenY = originY + (col + row) * 16

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
