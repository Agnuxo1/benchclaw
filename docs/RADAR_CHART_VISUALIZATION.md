# Radar Chart Visualization Spec

This document defines the radar chart work for https://github.com/Agnuxo1/benchclaw/issues/1.

## Goal

BenchClaw should show a compact 10-dimension radar chart for one or more agents so users can compare strengths and weaknesses without reading raw JSON.

The chart should support:

- single-agent score profile,
- two-agent comparison,
- top-N leaderboard comparison,
- export as PNG/SVG where the runtime supports it,
- CLI-friendly HTML output for users who do not run a web server.

## Score Dimensions

Use the existing 10 benchmark dimensions from the README:

| Key | Label | Weight |
|---|---|---:|
| `reasoning_depth` | Reasoning Depth | 15 |
| `mathematical_rigor` | Mathematical Rigor | 12 |
| `code_quality` | Code Quality | 10 |
| `tool_use` | Tool Use | 10 |
| `factual_accuracy` | Factual Accuracy | 10 |
| `creativity` | Creativity | 8 |
| `coherence` | Coherence | 8 |
| `safety_alignment` | Safety and Alignment | 8 |
| `efficiency` | Efficiency | 7 |
| `reproducibility` | Reproducibility | 7 |

Scores should be normalized to `0..100` before plotting.

## Data Contract

A plotting function should accept this normalized shape:

```json
{
  "agents": [
    {
      "id": "benchclaw-claude-opus",
      "label": "Claude Opus / OpenClaw",
      "scores": {
        "reasoning_depth": 91,
        "mathematical_rigor": 88,
        "code_quality": 84,
        "tool_use": 93,
        "factual_accuracy": 90,
        "creativity": 86,
        "coherence": 92,
        "safety_alignment": 89,
        "efficiency": 80,
        "reproducibility": 87
      },
      "tribunal_iq": 142
    }
  ]
}
```

The visualization layer should not depend on live API calls. Fetching leaderboard data belongs in the CLI or web client; plotting should accept already-normalized data.

## Python / Plotly Implementation Plan

If the repository adds a Python package path later, use:

| File | Responsibility |
|---|---|
| `benchclaw/visualization.py` | Pure functions for radar chart creation. |
| `benchclaw/cli.py` | CLI command such as `benchclaw radar --agent <id> --out radar.html`. |
| `tests/test_visualization.py` | Unit tests for normalization and chart construction. |

Suggested public functions:

```python
DIMENSIONS = [
    ("reasoning_depth", "Reasoning Depth"),
    ("mathematical_rigor", "Mathematical Rigor"),
    ("code_quality", "Code Quality"),
    ("tool_use", "Tool Use"),
    ("factual_accuracy", "Factual Accuracy"),
    ("creativity", "Creativity"),
    ("coherence", "Coherence"),
    ("safety_alignment", "Safety and Alignment"),
    ("efficiency", "Efficiency"),
    ("reproducibility", "Reproducibility"),
]


def build_radar_figure(agents: list[dict]):
    """Return a Plotly figure for normalized BenchClaw agent scores."""
```

Implementation notes:

- close each radar trace by repeating the first dimension at the end,
- clamp scores to `0..100`,
- show `tribunal_iq` in hover text, not as a radar axis,
- use accessible colors and visible line contrast,
- keep agent labels short in the legend.

## Web Implementation Plan

The standalone web UI can use a small canvas/SVG radar chart if Plotly is too heavy. Requirements are the same:

- fixed 10-axis order,
- `0..100` scale rings,
- legend for compared agents,
- hover or side panel for exact numbers,
- no layout shift on mobile.

## CLI UX

Recommended commands:

```bash
benchclaw radar --agent benchclaw-claude-opus --out radar.html
benchclaw radar --compare benchclaw-a,benchclaw-b --out compare.html
benchclaw radar --top 5 --out top5.html
```

Expected behavior:

- If `--out` ends in `.html`, write a self-contained HTML file.
- If image export dependencies are installed, allow `.png` and `.svg`.
- If a requested agent is missing, print a concise error with the available lookup command.

## Acceptance Criteria

- [ ] A radar chart can be generated for one agent.
- [ ] A radar chart can compare at least two agents.
- [ ] All 10 dimensions are shown in the README order.
- [ ] Scores are normalized and clamped to `0..100`.
- [ ] Tribunal IQ appears as metadata, not as an axis.
- [ ] CLI output can be opened locally without a running backend.
- [ ] Tests cover missing dimensions, out-of-range scores, and multi-agent traces.

## Example Test Cases

```python
def test_scores_are_clamped():
    assert normalize_score(-4) == 0
    assert normalize_score(104) == 100


def test_all_dimensions_are_present():
    figure = build_radar_figure([agent_fixture()])
    assert set(extract_axis_labels(figure)) == set(label for _, label in DIMENSIONS)


def test_multi_agent_chart_has_one_trace_per_agent():
    figure = build_radar_figure([agent_fixture("a"), agent_fixture("b")])
    assert len(figure.data) == 2
```

## Release Note

When implemented, add a short README section under `Connect your agent` linking to the radar command and showing one generated image or HTML screenshot.
