import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

async function checkTables() {
    console.log("Checking for database tables...");
    
    // Check for chat_conversations
    const { error: convError } = await supabaseAdmin
        .from("chat_conversations")
        .select("id")
        .limit(1);
    
    if (convError) {
        if (convError.message.includes("Could not find the table")) {
            console.error("❌ Table 'chat_conversations' MISSING");
        } else {
            console.error("⚠️ Error checking 'chat_conversations':", convError.message);
        }
    } else {
        console.log("✅ Table 'chat_conversations' EXISTS");
    }

    // Check for chat_messages
    const { error: msgError } = await supabaseAdmin
        .from("chat_messages")
        .select("id")
        .limit(1);
    
    if (msgError) {
        if (msgError.message.includes("Could not find the table")) {
            console.error("❌ Table 'chat_messages' MISSING");
        } else {
            console.error("⚠️ Error checking 'chat_messages':", msgError.message);
        }
    } else {
        console.log("✅ Table 'chat_messages' EXISTS");
    }

    // Check for resumes (core table)
    const { error: resumeError } = await supabaseAdmin
        .from("resumes")
        .select("id")
        .limit(1);
    
    if (resumeError) {
        console.error("⚠️ Error checking 'resumes':", resumeError.message);
    } else {
        console.log("✅ Table 'resumes' EXISTS");
    }
}

checkTables().catch(console.error);
