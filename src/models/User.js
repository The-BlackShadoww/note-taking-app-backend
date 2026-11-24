import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Invalid email"],
        },
        password: {
            type: String,
            required: true,
            select: false, // never returned by queries unless asked for
            minlength: [8, "Password must be at least 8 characters"],
            maxlength: [72, "Password must be at most 72 characters"], // bcrypt only uses the first 72 bytes
        },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        interests: [
            { type: String, trim: true, lowercase: true, maxlength: 40 },
        ],
    },
    { timestamps: true },
);

// ---------- Indexes: each one exists for a specific query ----------
// Login: User.findOne({ email }). The unique option also guarantees one account per email.
userSchema.index({ email: 1 }, { unique: true });
// Scenario 1: the group-by-interest pipeline starts with $match { interests: <value> } (multikey).
userSchema.index({ interests: 1 });
// Profile by id, the auth middleware, the admin list (sorted by _id) and Scenario 2's first
// $match all use the automatic _id index. No other index is needed.

// Hash the password whenever it is new or changed (runs on create() and save(), NOT on updates)
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

// Never send the hash or the version key to a client
userSchema.set("toJSON", {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    },
});

export const User = mongoose.model("User", userSchema);
