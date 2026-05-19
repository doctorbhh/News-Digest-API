import mongoose from "mongoose";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
    {
        apiKey: {
            type: String,
            required: true,
            unique: true,
            default: () => crypto.randomUUID(),
        },

        subscribedTopics: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ apiKey: 1 });

export default mongoose.model("User", userSchema);
