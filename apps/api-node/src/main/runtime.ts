import { pool } from "./database.js";
import { createPersistence } from "./persistence.js";
import { createServices } from "./services.js";
export const persistence = createPersistence(pool);
export const services = createServices(persistence);
