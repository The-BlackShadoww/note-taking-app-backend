// Fail fast: refuse to start without the settings the app can't work without,
// instead of failing later with a confusing 500 on the first request.
const REQUIRED = ["MONGODB_URI", "JWT_SECRET"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
    throw new Error(
        `Missing environment variable(s): ${missing.join(", ")}. ` +
            "Copy .env.example to .env (or set them in your host's settings).",
    );
}
