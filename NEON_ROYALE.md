# CYBER — Neon Royale

A interface ativa agora e `src/neon/main.js`, carregada pelo `index.html`.
Os modulos antigos continuam no repositorio como referencia e para preservar a compatibilidade do save anterior; nao sao a interface ativa.

- Casa: hack de sequencia entrega 1 informacao; melhoria de PC custa 150 e aumenta o premio para 2 informacoes. A venda acontece na BLACKNET por 30 BYTE cada.
- Cada tentativa de hack custa 10 de energia, mesmo se errar ou fechar. Energia maxima 100, recuperacao de 1 a cada 30 segundos, inclusive fora do jogo.
- Trade BITE/BYTE no PC da casa: aposta 20, retorno 38 no acerto, chance 50%. Grafico ilustrativo, saldo virtual.
- Pets decorativos: os tres gatos originais custam 100 BYTE cada e aparecem em casa.
- NEON ROYALE ocupa o antigo Data Terminal; roleta europeia de 37 casas, aposta 20 em vermelho ou preto, retorno 40 no acerto. Zero perde. Giro de 4 segundos com desaceleracao nos segundos finais.
- Bar, CORP e VIP fechados com cadeados visiveis.
- Novos sprites frontais, laterais e traseiros fieis aos quatro retratos originais. Esquerda espelha a direita; passos usam uma alternancia sutil dos pes.
- WASD, setas, clique para caminhar e botoes de movimento. Atalhos de locais para casa/cidade/cassino.
- Os reflexos e particulas foram preservados. As salas agora redesenham paredes em primeiro plano; a colisao da divisoria do banheiro da casa foi corrigida.
- Sem trabalhadores, ginasio, bebidas ou acao de dormir na interface ativa.

## Salvamento

Novo armazenamento `cyberback.neon.v2`; o `cyberback.save.v1` original nao e alterado. Saldo, energia, pets e personagem sao migrados. Informacoes ficam salvas no inventario; saves da versao Neon anterior comecam com estoque zero, sem alterar o saldo. A migracao direta do save v1 tambem recupera as informacoes antigas em um estoque unico. As mecanicas retiradas permanecem somente no save antigo. Rodadas pendentes persistem junto com o debito e sao liquidadas uma unica vez ao recarregar. Saves ilegíveis sao preservados. O jogo volta para a cidade ao abrir; saldo e compras continuam salvos.

## Validacao

`node --test tests/*.test.js` executa os testes existentes e `tests/neon.test.js`, que cobre energia, premios, compras, migracao, apostas, recarga durante rodada, caminhos do cassino e preservacao dos efeitos do mapa.

## Corretor da BLACKNET

Cipher fica na mesa direita da BLACKNET. Clique no NPC ou use Falar com Cipher para caminhar ate ele; adjacente, E abre o dialogo. Vendas exigem proximidade, preservam o valor de 30 BYTE por informacao e nao podem ser repetidas sem estoque. A celula do NPC bloqueia passagem.

## Paredes, cadeira e hack de memoria

Todas as salas ativas desenham a parede na frente do personagem. Hack e trade exigem caminhar ate o PC; o personagem aparece sentado de costas, com o encosto original da cadeira a frente do corpo. Ao fechar o PC ele volta a ficar em pe.

O hack mostra 5 simbolos (A/B/C/D) por 1,8 segundo, esconde a sequencia e aceita respostas durante 7 segundos. Resposta errada ou prazo esgotado falham, sem devolver os 10 de energia. Rota de caminhada e trailer usam o mesmo calculo de caminho, respeitando as celulas bloqueadas.
