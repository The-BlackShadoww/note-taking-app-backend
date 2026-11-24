const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50; // a client can't ask for ?limit=1000000 and overload the server

// Reads ?page and ?limit from the query string, falling back to safe defaults
export function getPagination(query) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT),
    );
    return { page, limit, skip: (page - 1) * limit };
}

// The response shape every paginated list uses
export function paginated(data, { page, limit }, total) {
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
