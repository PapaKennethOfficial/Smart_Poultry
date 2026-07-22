/**
 * Axios instance for talking to the SmartPoultry AI microservice
 * (Python + FastAPI). Every request is signed with the shared API key
 * from the AI_SERVICE_API_KEY env var — the AI service rejects any
 * request without it.
 *
 * Env vars:
 *   AI_SERVICE_URL       Base URL of the AI service (default http://localhost:8000)
 *   AI_SERVICE_API_KEY   Shared secret (also set on the AI service side)
 *   AI_SERVICE_TIMEOUT   Request timeout in ms (default 30_000)
 */

const axios = require("axios")

const aiClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL || "http://localhost:8000",
  timeout: Number(process.env.AI_SERVICE_TIMEOUT) || 30_000,
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.AI_SERVICE_API_KEY || "",
  },
})

module.exports = aiClient
