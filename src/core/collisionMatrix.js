// Matriz binaria de colisao, separada da camada visual (CYBER_SPEC.md).
export class CollisionMatrix {
  constructor(width, height, source) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
    if (source) {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          this.cells[row * width + col] = source[row]?.[col] ? 1 : 0;
        }
      }
    }
  }

  inBounds(col, row) {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  isBlocked(col, row) {
    if (!this.inBounds(col, row)) return true;
    return this.cells[row * this.width + col] === 1;
  }

  block(col, row) {
    if (!this.inBounds(col, row)) return;
    this.cells[row * this.width + col] = 1;
  }

  blockFootprint(originCol, originRow, footprintW, footprintH) {
    for (let dy = 0; dy < footprintH; dy++) {
      for (let dx = 0; dx < footprintW; dx++) {
        this.block(originCol + dx, originRow + dy);
      }
    }
  }
}
