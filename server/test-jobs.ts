import { searchJobs } from "./src/services/jobFetcher.js";

async function run() {
    try {
        const res = await searchJobs({ city: "Hyderabad", experience_max: 0 });
        console.log(`Found ${res.total} jobs.`);
        if (res.data.length > 0) {
            console.log(res.data[0].title, res.data[0].location);
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}
run();
