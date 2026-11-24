// Copies only the allowed fields from a request body (protects against mass assignment,
// e.g. a user sending { "role": "admin" } when registering)
export function pick(source = {}, allowed) {
    const out = {};
    for (const key of allowed) {
        if (source[key] !== undefined) out[key] = source[key];
    }
    return out;
}
