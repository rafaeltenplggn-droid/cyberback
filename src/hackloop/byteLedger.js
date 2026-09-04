// Ledger de BYTE: log append-only de cada ganho ou gasto. Mesmo padrao de
// auditoria usado nos outros projetos - sem edicao retroativa, nenhum
// metodo de remocao/edicao e exposto, cada entrada e congelada ao ser
// gravada.
export class ByteLedger {
  constructor({ now = () => Date.now() } = {}) {
    this._entries = [];
    this._now = now;
  }

  /** Grava uma entrada nova. type: 'gain' (ganho) ou 'spend' (gasto). */
  record({ type, amount, meta = {} }) {
    if (type !== 'gain' && type !== 'spend') {
      throw new Error(`type invalido: ${type}`);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('amount deve ser um numero >= 0');
    }

    const entry = Object.freeze({
      id: this._entries.length + 1,
      type,
      amount,
      meta: Object.freeze({ ...meta }),
      timestamp: this._now(),
    });
    this._entries.push(entry);
    return entry;
  }

  /** Copia das entradas, na ordem em que foram gravadas. O log interno nunca e exposto pra mutacao. */
  get entries() {
    return this._entries.slice();
  }

  get balance() {
    return this._entries.reduce((sum, entry) => sum + (entry.type === 'spend' ? -entry.amount : entry.amount), 0);
  }
}
