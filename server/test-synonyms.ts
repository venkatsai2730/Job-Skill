import { normalizeSynonyms, inferSkills } from "./src/lib/synonym-map.js";

// Test synonym normalization
const testText = "I used ReactJS and Vue.js with Node.js and Amazon Web Services. Built with CI/CD pipelines and machine learning models.";
const normalized = normalizeSynonyms(testText);
console.log("=== SYNONYM TEST ===");
console.log("Original:", testText);
console.log("Normalized:", normalized);
console.log("");

// Test skill inference
const testResume = "Built web application for e-commerce. Deployed to cloud with CI/CD pipeline. Trained machine learning model for recommendations. Led team of 5 engineers. Designed REST API. Implemented authentication system.";
const inferred = inferSkills(testResume);
console.log("=== INFERENCE TEST ===");
console.log("Resume:", testResume);
console.log("Inferred skills:", inferred);
console.log("Count:", inferred.length);
