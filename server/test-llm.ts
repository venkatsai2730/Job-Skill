import { getAIReply } from "./src/services/chatService.js";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
    console.log("Testing Groq (chat) ...");
    try {
        const res = await getAIReply([{ role: "user", content: "Hello" }], "chat");
        console.log("Groq OK:", res.reply.substring(0, 50));
    } catch(e: any) {
        console.error("Groq Failed:", e.message);
    }

    console.log("\nTesting Gemini (resume_pdf) ...");
    try {
        const res = await getAIReply([{ role: "user", content: "Score this resume: John Doe software engineer" }], "resume_pdf");
        console.log("Gemini OK:", res.reply.substring(0, 50));
    } catch(e: any) {
        console.error("Gemini Failed:", e.message);
    }

    console.log("\nTesting Mistral (code_gen) ...");
    try {
        const res = await getAIReply([{ role: "user", content: "Language: latex\\n\\nCreate a simple document" }], "code_gen");
        console.log("Mistral OK:", res.reply.substring(0, 50));
    } catch(e: any) {
        console.error("Mistral Failed:", e.message);
    }
}
run();
