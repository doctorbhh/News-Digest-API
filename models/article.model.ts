import mongoose from "mongoose";

const articleSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        normalizedTitle: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        content: {
            type: String,
            default: ""
        },

        summary: {
            type: String,
            required: true,
            maxlength: 1000
        },

        source: {
            name: {
                type: String,
                required: true,
                trim: true
            },

            type: {
                type: String,
                enum: ["rss", "api"],
                required: true
            },

            homepage: {
                type: String,
                default: ""
            }
        },

        url: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        topic: {
            type: String,
            required: true,
            trim: true
        },

        normalizedTopic: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        keywords: [
            {
                type: String,
                trim: true,
                lowercase: true
            }
        ],

        sentiment: {
            type: String,
            enum: [
                "positive",
                "neutral",
                "negative"
            ],
            default: "neutral"
        },

        clusterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cluster"
        },

        publishedAt: {
            type: Date,
            required: true
        },

        fetchedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

articleSchema.index({
    normalizedTitle: 1
});

articleSchema.index({
    topic: 1
});

articleSchema.index({
    clusterId: 1
});

articleSchema.index({
    publishedAt: -1
});

articleSchema.index({
    sentiment: 1
});

articleSchema.index({
    title: "text",
    summary: "text"
});

export default mongoose.model(
    "Article",
    articleSchema
);