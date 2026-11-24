import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: { type: String, required: true, trim: true, maxlength: 200 },
        content: { type: String, required: true, maxlength: 20000 },
    },
    { timestamps: true },
);

// Scenario 2: $lookup foreignField 'author' (Equality), then $sort { _id: -1 } inside the lookup.
// Its prefix { author } also serves deleteMany({ author }).
postSchema.index({ author: 1, _id: -1 });

export const Post = mongoose.model("Post", postSchema);
