// Mercado da BITE: minijogo de apostar se o preco vai subir ou descer no
// proximo "candle" - sem preco de verdade nenhum, e' so um random walk
// deterministico via rng (mesmo espirito de hackSession.js). Acessivel do
// laptop do bar e do PC de casa (ver BITE_TRADE_LOCATIONS em main.js).
export const BITE_TRADE_STAKE_BYTE = 20;
export const BITE_TRADE_PAYOUT_BYTE = 40;
export const BITE_CANDLE_INTERVAL_MS = 4000;
export const BITE_HISTORY_LENGTH = 24;
export const BITE_START_PRICE = 100;

export const BITE_TRADE_REASON = {
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

export class BiteMarket {
  constructor({ startPrice = BITE_START_PRICE, rng = Math.random } = {}) {
    this._rng = rng;
    this._price = startPrice;
    this._history = [startPrice];
    this._accumulatedMs = 0;
  }

  get price() {
    return this._price;
  }

  /** Copia do historico de precos (mais antigo primeiro), ate BITE_HISTORY_LENGTH pontos. */
  get history() {
    return this._history.slice();
  }

  /** Avanca o mercado sozinho - um candle novo a cada BITE_CANDLE_INTERVAL_MS, mesmo com a tela fechada. */
  tick(deltaMs) {
    this._accumulatedMs += deltaMs;
    while (this._accumulatedMs >= BITE_CANDLE_INTERVAL_MS) {
      this._accumulatedMs -= BITE_CANDLE_INTERVAL_MS;
      this._stepCandle();
    }
  }

  _stepCandle() {
    const pctChange = (this._rng() - 0.5) * 0.1; // +-5% por candle
    this._price = Math.max(1, this._price * (1 + pctChange));
    this._history.push(this._price);
    if (this._history.length > BITE_HISTORY_LENGTH) {
      this._history.shift();
    }
    return this._price;
  }

  /**
   * Aposta 'up' ou 'down': cobra BITE_TRADE_STAKE_BYTE na hora, forca um
   * candle novo (nao espera o proximo tick automatico) e paga
   * BITE_TRADE_PAYOUT_BYTE se acertou a direcao. Recusa sem cobrar nada
   * se o saldo for insuficiente.
   */
  trade(direction, { ledger }) {
    if (!ledger || ledger.balance < BITE_TRADE_STAKE_BYTE) {
      return { success: false, reason: BITE_TRADE_REASON.NOT_ENOUGH_BYTE };
    }
    ledger.record({ type: 'spend', amount: BITE_TRADE_STAKE_BYTE, meta: { source: 'bite_trade', direction } });

    const priceBefore = this._price;
    const priceAfter = this._stepCandle();
    const wentUp = priceAfter > priceBefore;
    const correct = direction === 'up' ? wentUp : !wentUp;

    if (correct) {
      ledger.record({ type: 'gain', amount: BITE_TRADE_PAYOUT_BYTE, meta: { source: 'bite_trade_payout', direction } });
    }

    return {
      success: true,
      reason: null,
      correct,
      priceBefore,
      priceAfter,
      byteDelta: correct ? BITE_TRADE_PAYOUT_BYTE - BITE_TRADE_STAKE_BYTE : -BITE_TRADE_STAKE_BYTE,
    };
  }
}
