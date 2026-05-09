// Azure Functions v4 entry point — registers all HTTP triggers
import "./functions/health.js";
import "./functions/assignments.js";
import "./functions/batches.js";
import "./functions/seed.js";
import "./functions/debug-schema.js";
import "./functions/upload/forecast.js";
import "./functions/upload/cv.js";
