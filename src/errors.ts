export class HttpError extends Error {
  status: number;

  constructor(status: number, msg: string) {
    super();
    this.status = status;
    this.message = msg;
  }
}
