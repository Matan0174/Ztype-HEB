export class Pool {
  constructor(createFn, resetFn) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
  }

  get(...args) {
    let obj = this.pool.length > 0 ? this.pool.pop() : this.createFn();
    this.resetFn(obj, ...args);
    return obj;
  }

  release(obj) {
    this.pool.push(obj);
  }
}
