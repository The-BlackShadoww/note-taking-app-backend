# Secure Note-Taking API

A REST API for a note-taking platform with secure authentication and role-based access control,
built with **Express 5, MongoDB/Mongoose, JWT and bcrypt**. The focus of the task is
**indexing and aggregation**, so this README explains every index and both pipelines.

| | |
|---|---|
| Live API | https://note-taking-app-backend-lac.vercel.app (health: [`/api/health`](https://note-taking-app-backend-lac.vercel.app/api/health)) |
| Live frontend | https://note-taking-app-frontend-pied.vercel.app |
| Frontend repository | https://github.com/The-BlackShadoww/note-taking-app-frontend |

---

## Features

| Role | Can do |
|---|---|
| **User** | Register and log in; create, list, view, update and delete **their own** notes; write posts and read everyone's posts; see users grouped by interest (Scenario 1); see one user's posts (Scenario 2); update their profile |
| **Admin** | Everything a user can (admins have their own notes too), plus: list, create, update and delete **any** user (including roles), and view **everyone's** notes (read-only) |

## Tech stack

Node.js 22+ · Express 5 · MongoDB + Mongoose · jsonwebtoken (JWT) · bcryptjs · cors.
Five runtime dependencies, no templates or generators. Deployed on Vercel; database on MongoDB Atlas.

## Run it locally

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run seed              # demo data + the admin from .env; also syncs the indexes
npm run dev               # http://localhost:3000
npm run explain           # prints which index every important query uses
```

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | MongoDB connection string; the database name goes before the `?` (`/notes_app`). URL-encode special characters in the password |
| `JWT_SECRET` | A long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime, default `1d` |
| `CLIENT_URL` | Comma-separated frontend origins allowed by CORS |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin account the seed script creates |

The server refuses to start if `MONGODB_URI` or `JWT_SECRET` is missing.

**Demo accounts** (created by `npm run seed`): `alice@example.com` and `bob@example.com`, password
`password123`. The admin account comes from your `.env`.

`requests.http` contains ready-made requests for every endpoint (VS Code REST Client).

---

## API

All routes are under `/api`. Every list accepts `?page=` (default 1) and `?limit=` (default 10, max 50).
Errors are always `{ "error": "message" }`.

| Method | Path | Access | Description | Index used |
|---|---|---|---|---|
| POST | `/auth/register` | public | Create an account (always role `user`), returns a JWT | `email_1` (unique) |
| POST | `/auth/login` | public | Returns a JWT | `email_1` |
| GET | `/users/me` | logged in | My profile | `_id_` |
| PATCH | `/users/me` | logged in | Update name, interests, password | `_id_` |
| GET | `/users/by-interest?interest=` | logged in | **Scenario 1**: users grouped by interest | `interests_1` |
| GET | `/users/:id/posts` | logged in | **Scenario 2**: a user's posts via `$lookup` | `_id_` + `author_1__id_-1` |
| GET | `/notes` | logged in | My notes, newest first | `user_1__id_-1` |
| POST | `/notes` | logged in | Create a note | — |
| GET / PATCH / DELETE | `/notes/:id` | owner only | One of my notes (someone else's → 404) | `_id_` |
| GET | `/posts` | logged in | Everyone's posts, newest first | `_id_` |
| POST | `/posts` | logged in | Create a post | — |
| GET / POST | `/admin/users` | admin | List / create users | `_id_` |
| GET / PATCH / DELETE | `/admin/users/:id` | admin | One user | `_id_` |
| GET | `/admin/notes` | admin | Everyone's notes, with owner | `_id_` |
| GET | `/admin/notes/:id` | admin | Any one note (read-only) | `_id_` |

Status codes: `400` invalid input · `401` not logged in / bad token · `403` not allowed (role) ·
`404` not found (including other users' notes) · `409` email already registered.

---

## Authentication and authorization

- **Passwords** are hashed with **bcrypt (cost 12)** in a `pre("save")` hook (`src/models/User.js`).
  The hash has `select: false` and is removed by `toJSON`, so it never reaches a response.
- **Login** (`src/controllers/auth.controller.js`) rejects non-string input (blocks NoSQL injection
  such as `{ "$ne": null }`), looks the user up through the unique `email_1` index, and returns the
  **same 401 message** for a wrong email and a wrong password.
- **The JWT holds only `{ sub: userId }`**. `authenticate` (`src/middleware/auth.js`) verifies the
  signature and expiry with the algorithm pinned to HS256, then **loads the user from MongoDB on every
  request**, so a deleted user or a changed role takes effect immediately.
- **Roles**: `authorize("admin")` guards every admin route in one line
  (`router.use(authenticate, authorize("admin"))` in `src/routes/admin.routes.js`). User routes only
  require `authenticate`, which is how admins inherit user abilities.
- **Ownership** is inside every note query: `{ _id: id, user: req.user._id }`. Another user's note is
  simply not found (404), which prevents IDOR without revealing that the id exists.
- **Mass assignment**: `pick()` copies only allowed fields, so a client can never set `role` (on
  register) or change a note's owner.
- Admins cannot delete or demote themselves. Deleting a user also deletes their notes and posts.
- CORS allows only the frontend's origin; the token travels in the `Authorization` header.

---

## Indexing strategy

Every index exists because a specific query needs it. All are declared with `schema.index()` in
`src/models/`, each with a comment naming its query. **7 indexes in total: 3 automatic `_id` + 4 custom.**

| Collection | Index | Queries it serves |
|---|---|---|
| users | `_id` (automatic) | `authenticate` and `/users/me`, admin user list and `GET /admin/users/:id`, `populate()` of authors/owners, Scenario 2's first `$match` |
| users | `{ email: 1 }` **unique** | Login lookup; one account per email (duplicates → 409, with no race condition) |
| users | `{ interests: 1 }` (multikey) | Scenario 1's first `$match`, with or without a filter |
| notes | `_id` (automatic) | Get / update / delete one note (`{ _id, user }`), admin "all notes" list and detail |
| notes | `{ user: 1, _id: -1 }` | "My notes" `find({ user }).sort({ _id: -1 })` with no in-memory sort, its `countDocuments` (COUNT_SCAN), cascade `deleteMany({ user })` |
| posts | `_id` (automatic) | Public posts feed |
| posts | `{ author: 1, _id: -1 }` | Scenario 2's `$lookup` on `author` plus the `$sort` inside it; cascade `deleteMany({ author })` |

**Design choices**

- **ESR rule**: in `{ user: 1, _id: -1 }`, `user` is the **E**quality field and `_id` the **S**ort field,
  so one index both filters and returns notes newest first.
- **Sorting by `_id` instead of `createdAt`**: an ObjectId starts with its creation timestamp, so
  `_id: -1` means newest first. Every unfiltered list (admin users, admin notes, posts feed) therefore
  needs **no extra index**, and pages never shuffle because `_id` is unique.
- **Counting**: filtered totals use `countDocuments` (served by the index, 0 documents read);
  unfiltered totals use `estimatedDocumentCount` (collection metadata, no scan).

**Indexes deliberately not created**

| Not created | Why |
|---|---|
| `{ createdAt: -1 }` | `_id` already gives creation order |
| `{ user: 1 }`, `{ author: 1 }` | Prefixes of the compound indexes, which already serve them |
| `{ role: 1 }` | No query filters by role (and only two values) |
| `{ title: 1 }` / text index | There is no search feature |

**Proof** (`npm run explain` on the seeded data):

| Query | Plan | Keys / docs examined |
|---|---|---|
| Login | IXSCAN `email_1` | 1 / 1 |
| My notes, page 2 | IXSCAN `user_1__id_-1`, no SORT stage | 20 / 10 |
| My notes total | COUNT_SCAN `user_1__id_-1` | 25 / **0** |
| One note | IXSCAN `_id_` | 1 / 1 |
| Admin users · admin notes · posts feed | IXSCAN `_id_`, no SORT stage | 10 / 10 |
| Scenario 1, `interest=chess` | IXSCAN `interests_1` | 3 / 3 |
| Scenario 1, all groups | IXSCAN `interests_1` | 6 / 4 (the user with no interests is never read) |
| Scenario 2, limit 5 | `_id_` + IXSCAN `author_1__id_-1` | 1 / 1 and 6 / 6 |

Mongoose builds indexes automatically in development only (`autoIndex` is off when
`NODE_ENV=production`, so serverless cold starts don't issue index builds). In production they are
built once by `npm run seed`, which runs `syncIndexes()` so the database matches the code exactly.

---

## Aggregations

Both pipelines are pure functions in `src/pipelines.js`, so they are easy to review and the explain
script reuses them.

### Scenario 1: users grouped by interests (`GET /api/users/by-interest`)

Exactly **one `User.aggregate()` call** in the handler; nothing else touches the database there.

| # | Stage | Purpose |
|---|---|---|
| ① | `$match { interests: <value> }` or `{ interests: { $type: "string" } }` | Always uses the multikey index; without a filter it keeps only users who have interests |
| ② | `$project { name, interests }` | Drop email, password, role early |
| ③ | `$unwind "$interests"` | One document per (user, interest) |
| ④ | `$match` again (filter only) | Drop the user's other interests |
| ⑤ | `$group` by interest | `userCount` (`$sum`) and `users` (`$firstN`, capped at 20 so a popular interest can't hit the 16 MB document limit) |
| ⑥ | `$sort { userCount: -1, _id: 1 }` | Most popular first; ties A→Z, so pages are stable |
| ⑦ | `$facet` | The page (`$skip` / `$limit`) **and** the total (`$count`) in the same call |
| ⑧ | `$project` | Final `{ data, total }` |

### Scenario 2: a user's posts (`GET /api/users/:id/posts`)

A single pipeline on `users` with a **`$lookup`** into `posts`:

1. `$match { _id }`: exactly one user, via `_id_`. The id is converted with
   `new mongoose.Types.ObjectId()` because `aggregate()` does not cast strings.
2. `$project { name }`: public fields only.
3. `$lookup` with `localField: "_id"`, `foreignField: "author"` and an inner pipeline
   `$sort { _id: -1 } → $skip → $limit: limit + 1 → $project`. The join condition plus the sort match
   `{ author: 1, _id: -1 }`, so MongoDB walks this user's posts in order and stops after
   `skip + limit + 1` entries.
4. `$project`: `$slice` back to `limit` and set `hasNextPage` if the extra post exists. Pagination
   without a count query.

An unknown user id gives an empty result → 404. A malformed id is rejected with 400 before the query.

---

## Pagination

`src/utils/pagination.js` reads `?page` and `?limit` (default 10, max 50; invalid values fall back to
defaults) and every list returns `{ data, pagination: { page, limit, total, totalPages } }`
(Scenario 2 returns `hasNextPage` instead of a total).

| List | Pages with | Total from |
|---|---|---|
| My notes | `skip` / `limit` on `{ user, _id }` | `countDocuments` (COUNT_SCAN) |
| Admin users, admin notes, posts feed | `skip` / `limit` on `_id_` | `estimatedDocumentCount` |
| Scenario 1 | `$skip` / `$limit` inside `$facet` | `$count` in the same `$facet` |
| Scenario 2 | `$skip` / `$limit` inside `$lookup` | none: `limit + 1` gives `hasNextPage` |

---

## Assumptions

- Self-registration always creates a `user`; only an admin can create admins.
- "Admins can view everyone's notes" is read-only: notes are changed only by their owner.
- Posts are visible to every **logged-in** user (not only their author).
- The interests view is available to every logged-in user and shows names only, never emails.
- Interests are stored trimmed and lowercased, so "Chess" and "chess " form one group.
- Lists are ordered newest first by `_id`.

## Project structure

```
src/
  app.js            middleware chain, routes, 404, error handler
  server.js         local start: connect to MongoDB, then listen
  config.js         refuses to start without MONGODB_URI / JWT_SECRET
  db.js             one shared connection (also used on Vercel); autoIndex setting
  pipelines.js      Scenario 1 and Scenario 2 pipelines
  models/           User, Note, Post: schemas, validation, indexes, password hook
  middleware/       auth (authenticate, authorize), validateId, error handler
  controllers/      auth, user, note, post, admin
  routes/           URL → guards → controller
  utils/            pagination, pick (mass-assignment guard), ApiError
scripts/
  seed.js           demo data + admin; syncIndexes()
  explain.js        prints the plan and index of every important query
```

## With more time

- Rate limiting on login, and refresh tokens for shorter-lived access tokens.
- A MongoDB transaction around "delete user + their notes and posts".
- Cursor pagination (`_id < lastSeenId`) for very deep pages.
- For a very large user base, precompute Scenario 1 into a collection with `$merge`.
- An automated test suite (`node --test` with a test database).
