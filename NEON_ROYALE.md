# CYBER — Neon Royale

A interface ativa agora e `src/neon/main.js`, carregada pelo `index.html`.
Os modulos antigos continuam no repositorio como referencia e para preservar a compatibilidade do save anterior; nao sao a interface ativa.

- Casa: hack de sequencia paga 30 BYTE; melhoria de PC custa 150 e aumenta o premio para 60.
- Cada tentativa de hack custa 10 de energia, mesmo se errar ou fechar. Energia maxima 100, recuperacao de 1 a cada 30 segundos, inclusive fora do jogo.
- Trade BITE/BYTE no PC da casa: aposta 20, retorno 38 no acerto, chance 50%. Grafico ilustrativo, saldo virtual.
- Pets decorativos: os tres gatos originais custam 100 BYTE cada e aparecem em casa.
- NEON ROYALE ocupa o antigo Data Terminal; roleta europeia de 37 casas, aposta 20 em vermelho ou preto, retorno 40 no acerto. Zero perde. Giro de 10 segundos com desaceleracao nos segundos finais.
- Bar, BLACKNET, CORP e VIP fechados com cadeados visiveis.
- Novos sprites frontais, laterais e traseiros fieis aos quatro retratos originais. Esquerda espelha a direita; passos usam uma alternancia sutil dos pes.
- WASD, setas, clique para caminhar e botoes de movimento. Atalhos de locais para casa/cidade/cassino.
- Os dados de reflexos, particulas e colisoes da cidade e da casa, assim como o Renderer original, foram preservados.
- Sem trabalhadores, inventario de informacoes, ginasio, bebidas ou acao de dormir na interface ativa.

## Salvamento

Novo armazenamento `cyberback.neon.v2`; o `cyberback.save.v1` original nao e alterado. Saldo, energia, pets e personagem sao migrados. As mecanicas retiradas permanecem somente no save antigo. Rodadas pendentes persistem junto com o debito e sao liquidadas uma unica vez ao recarregar. Saves ilegíveis sao preservados. O jogo volta para a cidade ao abrir; saldo e compras continuam salvos.

## Validacao

`node --test tests/*.test.js` executa os testes existentes e `tests/neon.test.js`, que cobre energia, premios, compras, migracao, apostas, recarga durante rodada, caminhos do cassino e preservacao dos efeitos do mapa.
