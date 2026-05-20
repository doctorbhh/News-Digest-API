import { analyzeSentiment } from "../services/sentimentAnalyzer.js";

const tests = [
    {
        name: "Student suicide article (was falsely positive)",
        title: "Called Good For Nothing By Teachers, Bihar Student Kills Self In Bengaluru",
        content: "A 23-year-old student in Bengaluru, identified as Chunnu, died by suicide after reportedly facing public humiliation and mental torture from his teachers. He was allegedly called good for nothing and burdened with excessive projects.",
        expected: "negative"
    },
    {
        name: "Clearly positive article",
        title: "India wins World Cup, celebrations across the nation",
        content: "India achieved a historic victory in the Cricket World Cup final, sparking celebrations across the country. The team was praised for their outstanding performance.",
        expected: "positive"
    },
    {
        name: "Neutral article",
        title: "Parliament session begins today",
        content: "The monsoon session of Parliament commenced today with several bills scheduled for discussion.",
        expected: "neutral"
    },
    {
        name: "Murder article",
        title: "Man murdered in broad daylight, suspect arrested",
        content: "A 35-year-old man was brutally murdered in broad daylight. Police have arrested the suspect.",
        expected: "negative"
    }
];

let passed = 0;
for (const t of tests) {
    const result = analyzeSentiment(t.title, t.content);
    const ok = result.label === t.expected;
    console.log(`${ok ? "✅" : "❌"} ${t.name}`);
    console.log(`   Expected: ${t.expected} | Got: ${result.label} (score: ${result.score})`);
    if (ok) passed++;
}

console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
