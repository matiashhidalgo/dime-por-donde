/**
 * Landmark silhouettes now live in the engine (src/engine/silhouettes.ts) so
 * station emblems and the trials can share the same machinery and be tested
 * without a DOM. Re-exported here for the views.
 */
export { landmarkShapes, type Silhouette as LandmarkShape } from "@/src/engine";
