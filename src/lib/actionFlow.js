// ============================================================
// ACTION FLOW CONFIG
// Defines what the next entry should be based on current action + outcome + type
//
// Each rule:
//   match:  { action, outcome, type }  — what was just logged (type is optional)
//   next:   { action, outcome, type, actionPlayer, reactionPlayer }
//
// Player values:
//   "prevAction"    → the player who performed the current action
//   "prevReaction"  → the reaction player from the current entry
//   null            → clear / no player
//
// Rules are checked top-to-bottom. First match wins.
// If no rule matches, the DEFAULT at the bottom is used.
// ============================================================

export const ACTION_FLOW = [

    // ── Pass / Through Ball Intercepted → Pass Intercept ──
    {
        match:  { action: "Pass", outcome: "Intercepted" },
        next:   { action: "Pass Intercept", outcome: null, type: null, actionPlayer: null, reactionPlayer: "prevAction" }
    },
    {
        match:  { action: "Through Ball", outcome: "Intercepted" },
        next:   { action: "Pass Intercept", outcome: null, type: null, actionPlayer: null, reactionPlayer: "prevAction" }
    },

    // ── Shoot → Save → Save action ──
    {
        match:  { action: "Shoot", outcome: "Save" },
        next:   { action: "Save", outcome: null, type: null, actionPlayer: "prevReaction", reactionPlayer: "prevAction" }
    },

    // ── Shoot → Block → Block action ──
    {
        match:  { action: "Shoot", outcome: "Block" },
        next:   { action: "Block", outcome: null, type: null, actionPlayer: "prevReaction", reactionPlayer: "prevAction" }
    },

    // ── Shoot → Goal → Match Time (reset) ──
    {
        match:  { action: "Shoot", outcome: "Goal" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Tackle Successful With Possession → same player keeps ball ──
    {
        match:  { action: "Standing Tackle", outcome: "Successful", type: "With Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Sliding Tackle", outcome: "Successful", type: "With Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },

    // ── Tackle Successful Without Possession → new player ──
    {
        match:  { action: "Standing Tackle", outcome: "Successful", type: "Without Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },
    {
        match:  { action: "Sliding Tackle", outcome: "Successful", type: "Without Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Tackle Unsuccessful → new player ──
    {
        match:  { action: "Standing Tackle", outcome: "Unsuccessful" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },
    {
        match:  { action: "Sliding Tackle", outcome: "Unsuccessful" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Tackle Foul → Discipline ──
    {
        match:  { action: "Standing Tackle", outcome: "Foul" },
        next:   { action: "Discipline", outcome: "Foul", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Sliding Tackle", outcome: "Foul" },
        next:   { action: "Discipline", outcome: "Foul", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },

    // ── Dribble Foul Won → Discipline ──
    {
        match:  { action: "Dribble", outcome: "Foul Won" },
        next:   { action: "Discipline", outcome: "Foul", type: null, actionPlayer: "prevReaction", reactionPlayer: null }
    },

    // ── Pass Intercept → next action depends on possession ──
    {
        match:  { action: "Pass Intercept", outcome: "Successful", type: "With Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Pass Intercept", outcome: "Successful", type: "Without Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Save → next depends on save type ──
    {
        match:  { action: "Save", outcome: "Gripping" },
        next:   { action: "Pass", outcome: "Successful", type: "Goalkeeper Throw", actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Save", outcome: "Pushing-in" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },
    {
        match:  { action: "Save", outcome: "Pushing-out" },
        next:   { action: "Pass", outcome: "Successful", type: "Corner Kick", actionPlayer: null, reactionPlayer: null }
    },

    // ── Block → next depends on possession ──
    {
        match:  { action: "Block", outcome: "Successful", type: "With Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Block", outcome: "Successful", type: "Without Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Clearance ──
    {
        match:  { action: "Clearance", outcome: "Successful", type: "With Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },
    {
        match:  { action: "Clearance", outcome: "Successful", type: "Without Possession" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },

    // ── Pressure Foul → Discipline ──
    {
        match:  { action: "Pressure", outcome: "Foul" },
        next:   { action: "Discipline", outcome: "Foul", type: null, actionPlayer: "prevAction", reactionPlayer: null }
    },

    // ── Substitution ──
    {
        match:  { action: "Substitution", outcome: "Off" },
        next:   { action: "Pass", outcome: "Successful", type: null, actionPlayer: null, reactionPlayer: null }
    },
];

// ── DEFAULT: used when no rule above matches ──
export const ACTION_FLOW_DEFAULT = {
    action: "Pass",
    outcome: "Successful",
    type: null,
    actionPlayer: "prevReaction_or_prevAction",  // prefer reaction player, fallback to action player
    reactionPlayer: null
};

// ============================================================
// RESOLVER — call this from the tagger
// ============================================================
export function getNextEntry(prevAction, prevOutcome, prevType, prevActionPlayer, prevReactionPlayer) {
    // Find first matching rule
    const rule = ACTION_FLOW.find(r => {
        if (r.match.action !== prevAction) return false;
        if (r.match.outcome && r.match.outcome !== prevOutcome) return false;
        if (r.match.type && r.match.type !== prevType) return false;
        return true;
    });

    const next = rule ? rule.next : ACTION_FLOW_DEFAULT;

    return {
        action:         next.action,
        outcome:        next.outcome,
        type:           next.type,
        actionPlayer:   resolvePlayer(next.actionPlayer, prevActionPlayer, prevReactionPlayer),
        reactionPlayer: resolvePlayer(next.reactionPlayer, prevActionPlayer, prevReactionPlayer),
    };
}

function resolvePlayer(value, prevActionPlayer, prevReactionPlayer) {
    if (value === "prevAction")   return prevActionPlayer;
    if (value === "prevReaction") return prevReactionPlayer;
    if (value === "prevReaction_or_prevAction") return prevReactionPlayer || prevActionPlayer;
    return null;
}
