export interface FrameBuffers {
  rgba: Uint8Array;
  i420: Uint8Array;
  width: number;
  height: number;
}

export class FrameBufferPool {
  private rgba?: Uint8Array;
  private i420?: Uint8Array;
  private width = 0;
  private height = 0;

  ensure(width: number, height: number): FrameBuffers {
    if (
      this.width !== width ||
      this.height !== height ||
      !this.rgba ||
      !this.i420
    ) {
      this.width = width;
      this.height = height;
      this.rgba = new Uint8Array(width * height * 4);
      this.i420 = new Uint8Array((width * height * 3) >> 1);
    }
    return { rgba: this.rgba, i420: this.i420, width, height };
  }

  release() {
    this.rgba = undefined;
    this.i420 = undefined;
    this.width = 0;
    this.height = 0;
  }
}
