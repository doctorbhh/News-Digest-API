import { scrapeContent } from "../services/scrapeContent.js";

const articleUrl ="https://www.indiatoday.in/sports/cricket/story/vaibhav-sooryavanshi-india-a-bcci-squad-announcement-tilak-varma-captain-sri-lanka-tri-series-2911674-2026-05-14";

async function main(): Promise<void> {
    const article = await scrapeContent({
        title: "How Vijay's anti-liquor push mirrors his Master arc",
        normalizedTitle: "how vijays anti liquor push mirrors his master arc",
        content: "",
        summary: "",
        source: {
            name: "India Today",
            type: "rss",
            homepage: "https://www.indiatoday.in",
        },
        url: articleUrl,
        topic: "general",
        normalizedTopic: "general",
        keywords: [],
        sentiment: "neutral",
        publishedAt: new Date("2026-05-14T00:00:00.000Z"),
    });

      console.log("Title:\n", article.title);
      console.log("\nContent identified:\n");
      console.log(article.content);
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    });
