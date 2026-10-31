import { describe } from "vitest";
import { propertySuite } from "./property";

describe("generator · hard · 2,000 seeds", () => propertySuite("hard"));
