// Bichinho de estimacao: puramente decorativo, sem efeito nenhum no
// jogo (nao ajuda a minerar, nao da bonus - so um "tenho ou nao tenho"
// mostrado na tela do PC). Comeca com um unico pet disponivel (o gato) -
// a lista existe pra dar espaco de sobra pra adicionar mais depois sem
// reestruturar nada, mesmo espirito de HIRABLE_WORKERS em workers.js.
export const PET_COST_BYTE = 100;

export const PETS = [{ id: 'gato', name: 'Gato' }];

export const PET_PURCHASE_REASON = {
  ALREADY_OWNED: 'ja_possui',
  INVALID: 'pet_invalido',
  NOT_ENOUGH_BYTE: 'byte_insuficiente',
};

export class PetCollection {
  constructor() {
    this._owned = new Set();
  }

  isOwned(petId) {
    return this._owned.has(petId);
  }

  /** Lista completa dos pets, com `owned` marcado pra cada um - pronta pra UI. */
  list() {
    return PETS.map((pet) => ({ ...pet, owned: this._owned.has(pet.id) }));
  }

  /** Compra um pet pagando PET_COST_BYTE do ledger. So pode comprar cada um uma vez. */
  buy(petId, { ledger }) {
    if (!PETS.some((pet) => pet.id === petId)) {
      return { success: false, reason: PET_PURCHASE_REASON.INVALID };
    }
    if (this._owned.has(petId)) {
      return { success: false, reason: PET_PURCHASE_REASON.ALREADY_OWNED };
    }
    if (!ledger || ledger.balance < PET_COST_BYTE) {
      return { success: false, reason: PET_PURCHASE_REASON.NOT_ENOUGH_BYTE };
    }
    ledger.record({ type: 'spend', amount: PET_COST_BYTE, meta: { source: 'pet_purchase', petId } });
    this._owned.add(petId);
    return { success: true, reason: null };
  }
}
