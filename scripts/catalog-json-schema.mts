/** Generates data/schema/catalog.schema.json for editor autocompletion/validation. */
import { mkdirSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { catalogFileSchema } from "../src/lib/catalog-import/schema.ts";

mkdirSync("data/schema", { recursive: true });
const schema = z.toJSONSchema(catalogFileSchema, { io: "input", unrepresentable: "any" });
writeFileSync("data/schema/catalog.schema.json", JSON.stringify({ title: "LaptopVerse catalog file", ...schema }, null, 2) + "\n");
console.log("data/schema/catalog.schema.json actualizado");
