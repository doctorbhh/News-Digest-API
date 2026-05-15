import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const uri = process.env.MONGO_URI as string;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        await client.db("admin").command({
            ping: 1
        });

        console.log(
            "MongoDB connection successful"
        );
    }
    catch (error) {
        console.error(
            "MongoDB connection failed:",
            error
        );
    }
    finally {
        await client.close();
    }
}

run();