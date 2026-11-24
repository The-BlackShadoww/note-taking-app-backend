// An Error that carries an HTTP status, so controllers can just `throw new ApiError(404, '...')`
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
