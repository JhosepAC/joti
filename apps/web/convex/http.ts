import { httpRouter } from "convex/server";

/**
 * HTTP router for the Convex deployment.
 *
 * No external identity providers are enabled. Keep this router empty until
 * the product explicitly supports another HTTP integration.
 */

const http = httpRouter();

export default http;
