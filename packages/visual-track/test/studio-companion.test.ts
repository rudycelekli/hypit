import assert from "node:assert/strict";
import test from "node:test";
import type { StudioTrackCompanionContext } from "@hypit/studio-companion";

import {
  visualClipTreatmentStudioFields,
  visualTrackStudioTrackCompanions,
} from "../src/studio.js";

test("Visual Studio keeps occurrence facts, treatment and typed Motion separate", () => {
  const companion = visualTrackStudioTrackCompanions[0]!;
  assert.equal(companion.family, "visual");
  const bindings = new Map((companion.bindings ?? []).map((binding) => [binding.name, binding]));

  for (const name of ["z", "fit", "source-time", "treatment", "motion"]) {
    assert.ok(bindings.has(name), `missing ${name}`);
  }
  assert.equal(bindings.has("appearance"), false);
  assert.ok("recipe" in bindings.get("treatment")!);
  assert.equal("recipe" in bindings.get("motion")!, false);

  const treatmentNames = visualClipTreatmentStudioFields.bindings.map(({ name }) => name);
  assert.deepEqual(treatmentNames, [
    "opacity", "blur", "brightness", "contrast", "saturation",
    "clip", "radius", "padding", "border-width", "border-style", "border-color", "shadows", "frame-paint",
  ]);
  assert.equal((companion.inspector ?? []).some(({ binding }) => /(?:enter|exit|sustain)/u.test(binding)), false);
});

test("Visual Studio finds the Window of each Clip that shares it", () => {
  // Two Clips `during={program.window}`. Lineage used to be looked up by Present id, which named
  // the Window; each Present is now named by its Clip, so the Window is found through the spec
  // its append step consumed.
  const companion = visualTrackStudioTrackCompanions[0]!;
  const span = { startFrame: 0, endFrameExclusive: 90 };
  const clip = (id: string, z: number) => ({ id, subjectId: id, span, frame: { xPx: 0, yPx: 0, widthPx: 1, heightPx: 1 },
    treatment: {}, layers: [], order: z, z });
  const endpoint = (frame: number) => ({ kind: "instant", frame, authority: { kind: "fixed" } });
  const projection = { kind: "window", start: endpoint(0), end: endpoint(90), startFrame: 0, endFrameExclusive: 90 };
  const consumer = (id: string) => ({ step: `append-${id}`, producer: { module: { name: "@hypit/visual-track", version: "1" }, name: "append-visual-clip" },
    input: "window", role: "domain", inputs: [{ name: "spec", record: `spec-${id}`, type: { module: { name: "@hypit/visual-track", version: "1" }, name: "VisualClipSpec" }, value: { id } }] });
  const context = {
    track: { outputRef: "track.visual", type: { module: { name: "@hypit/composition", version: "1" }, name: "VisualTrack" },
      trace: { references: [], outputPorts: [{ name: "program", ref: "program" }] } },
    values: new Map<string, unknown>([["program", { id: "track", clips: [clip("background", 0), clip("logo", 10)] }]]),
    spans: [],
    temporalBindings: [{ record: "program-window", subjectId: "program", id: "program", projection,
      consumers: [consumer("background"), consumer("logo")] }],
    temporalDomains: [],
  } as unknown as StudioTrackCompanionContext;
  const items = companion.project!(context);
  assert.deepEqual(items.map((item) => [item.authoredId, item.temporal?.record]), [
    ["background", "program-window"], ["logo", "program-window"],
  ]);
});
