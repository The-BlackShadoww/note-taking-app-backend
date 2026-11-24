import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        content: { type: String, default: "", maxlength: 20000 },
    },
    { timestamps: true },
);

// "My notes": find({ user }).sort({ _id: -1 }) + countDocuments({ user }).
// ESR: user is the Equality field, _id is the Sort field, so there's no in-memory sort.
// Its prefix { user } also serves deleteMany({ user }) when an admin deletes a user.
noteSchema.index({ user: 1, _id: -1 });

export const Note = mongoose.model("Note", noteSchema);
