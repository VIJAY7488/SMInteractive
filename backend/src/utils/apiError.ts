export class ApiError extends Error {
    statusCode: number;
    errors;
    success: boolean;
    constructor(message: string, statusCode = 500, errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.success = false;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}