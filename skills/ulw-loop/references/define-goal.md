# Define verifiable goals

Translate the user's request into observable outputs without narrowing scope. For each goal, record title, scenario, expected evidence, and essential success criteria. A criterion must describe a check that can fail, not merely a promise to do work. Include preservation of existing records and required integration behavior.

create-goals accepts a nonempty brief and refuses to overwrite an existing plan. Inspect status first. Use add-goal for additional required outputs. Custom successCriteria require unique nonempty ids, scenario, expectedEvidence, and at least one essential criterion. Keep returned goal and criterion ids; do not invent or reuse ids from another session.

Only explicit user instructions may remove a requirement. Record changed requirements through steer and reconcile the affected goals. Implementation difficulty is a reason to investigate alternatives, not silently exclude behavior.
