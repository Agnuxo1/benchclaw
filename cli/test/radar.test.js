const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RADAR_DIMENSIONS,
  buildRadarHtml,
  normalizeAgentScores,
  normalizeScore,
  parseArgs,
} = require("../index");

function fixture(overrides = {}) {
  const scores = Object.fromEntries(RADAR_DIMENSIONS.map(([key]) => [key, 75]));
  return {
    agents: [
      {
        id: "benchclaw-test",
        label: "Test Agent",
        tribunal_iq: 140,
        scores: { ...scores, ...overrides },
      },
    ],
  };
}

test("normalizeScore clamps values to the 0..100 radar range", () => {
  assert.equal(normalizeScore(-10), 0);
  assert.equal(normalizeScore(50.5), 50.5);
  assert.equal(normalizeScore(250), 100);
  assert.equal(normalizeScore("not-a-number"), 0);
});

test("normalizeAgentScores always returns all radar dimensions", () => {
  const [agent] = normalizeAgentScores(fixture({ reasoning_depth: 101 }));
  assert.equal(agent.scores.reasoning_depth, 100);
  for (const [key] of RADAR_DIMENSIONS) {
    assert.equal(typeof agent.scores[key], "number");
  }
});

test("buildRadarHtml renders the agent label, table, and svg polygon", () => {
  const html = buildRadarHtml(fixture());
  assert.match(html, /<svg viewBox=/);
  assert.match(html, /Test Agent/);
  assert.match(html, /Reasoning Depth/);
  assert.match(html, /<polygon points=/);
  assert.match(html, /Exact normalized scores/);
});

test("parseArgs supports radar CLI flags", () => {
  const args = parseArgs(["radar", "--file", "scores.json", "--out", "radar.html", "--top", "3"]);
  assert.deepEqual(args._, ["radar"]);
  assert.equal(args.file, "scores.json");
  assert.equal(args.out, "radar.html");
  assert.equal(args.top, "3");
});

test("buildRadarHtml accepts input parsed from JSON with a UTF-8 BOM", () => {
  const parsed = JSON.parse(("\uFEFF" + JSON.stringify(fixture())).replace(/^\uFEFF/, ""));
  const html = buildRadarHtml(parsed);
  assert.match(html, /Test Agent/);
});
