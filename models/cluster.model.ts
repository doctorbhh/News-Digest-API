import mongoose from "mongoose";

const clusterSchema = new mongoose.Schema(
    {
        topic: {
            type: String,
            required: true,
            trim: true,
            index: true
        },

        normalizedTopic: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true
        },

        headline: {
            type: String,
            required: true,
            trim: true
        },

        normalizedHeadline: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true
        },

        summary: {
            type: String,
            required: true,
            maxlength: 1000
        },

        keywords: {
            type: [String],
            default: []
        },

        articleIds: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Article"
                }
            ],
            default: []
        },

        articleCount: {
            type: Number,
            default: 0
        },

        sentimentDistribution: {
            positive: {
                type: Number,
                default: 0
            },

            neutral: {
                type: Number,
                default: 0
            },

            negative: {
                type: Number,
                default: 0
            }
        },

        sources: {
            type: [String],
            default: []
        },

        lastArticlePublishedAt: {
            type: Date,
            index: true
        }
    },
    {
        timestamps: true
    }
);

clusterSchema.index({
    topic: 1
});

clusterSchema.index({
    normalizedTopic: 1
});

clusterSchema.index({
    updatedAt: -1
});

clusterSchema.index({
    lastArticlePublishedAt: -1
});

export default mongoose.model(
    "Cluster",
    clusterSchema
);